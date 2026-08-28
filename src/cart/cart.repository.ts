import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  DiscountType,
  ItemType,
  NotificationType,
  OrderStatus,
  PaymentChannel,
  PaymentMethod,
  PaymentStatus,
  CreditTransactionType,
  Prisma,
  StockMovementType,
  AccountingEventType,
  AccountingSourceType,
  AccountPurpose,
  JournalSide,
} from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { AccountSeederService } from 'src/accounting/account-seeder.service';
import { AccountingPostingService } from 'src/accounting/accounting-posting.service';
import { saleRecognitionLines } from 'src/accounting/accounting-lines';

@Injectable()
export class CartRepository {
  private readonly logger = new Logger(CartRepository.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountSeeder: AccountSeederService,
    private readonly accounting: AccountingPostingService,
  ) {}

  async scanProduct(
    shopId: string,
    staffId: string,
    stationId: string,
    barcode: string,
  ) {
    this.logger.log(`Adding scanned barcode to cart in shop ${shopId}`);
    const activeKey = `${shopId}:${staffId}:${stationId}`;

    return this.prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({
          where: { shopId_barcode: { shopId, barcode } },
          select: {
            id: true,
            name: true,
            barcode: true,
            price: true,
            isActive: true,
            stockCache: { select: { currentQuantity: true } },
          },
        });
        if (!product?.isActive) {
          throw new NotFoundException(
            'No active product with this barcode exists in this shop',
          );
        }

        // StockCache is the fast, current answer to "how many can this shop
        // sell?" A missing cache row is treated as zero stock because adding
        // an untracked unit would let the cashier promise inventory we cannot
        // prove exists.
        const availableQuantity = product.stockCache?.currentQuantity ?? 0;
        if (availableQuantity < 1) {
          throw new ConflictException(`${product.name} is out of stock`);
        }

        const cart = await tx.cart.upsert({
          where: { activeKey },
          create: {
            shopId,
            staffId,
            stationId,
            activeKey,
            status: CartStatus.ACTIVE,
          },
          update: { updatedAt: new Date() },
          select: { id: true },
        });

        const existingItem = await tx.cartItem.findUnique({
          where: {
            cartId_itemType_itemId: {
              cartId: cart.id,
              itemType: ItemType.PRODUCT,
              itemId: product.id,
            },
          },
          select: { quantity: true },
        });

        // Scanning means "add one". Reject that scan when the resulting cart
        // quantity would exceed the shop's current stock. Checkout repeats a
        // stricter conditional stock update because another till may sell the
        // same units after this scan but before this cart is completed.
        const requestedQuantity = (existingItem?.quantity ?? 0) + 1;
        if (requestedQuantity > availableQuantity) {
          throw new ConflictException(
            `Only ${availableQuantity} unit${availableQuantity === 1 ? '' : 's'} of ${product.name} available`,
          );
        }

        await tx.cartItem.upsert({
          where: {
            cartId_itemType_itemId: {
              cartId: cart.id,
              itemType: ItemType.PRODUCT,
              itemId: product.id,
            },
          },
          create: {
            cartId: cart.id,
            itemType: ItemType.PRODUCT,
            itemId: product.id,
            quantity: 1,
            originalUnitPrice: product.price,
            finalUnitPrice: product.price,
          },
          update: { quantity: { increment: 1 } },
        });

        // Prisma's @updatedAt is not triggered by a CartItem write, so this
        // explicit update keeps abandoned-cart cleanup based on real activity.
        await tx.cart.update({
          where: { id: cart.id },
          data: { updatedAt: new Date() },
        });

        const result = await tx.cart.findUniqueOrThrow({
          where: { id: cart.id },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        });
        return this.hydrateProducts(tx, result);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getActiveCart(shopId: string, staffId: string, stationId: string) {
    this.logger.log(`Finding active cart in shop ${shopId}`);
    const activeKey = `${shopId}:${staffId}:${stationId}`;
    const cart = await this.prisma.cart.findUnique({
      where: { activeKey },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!cart) return null;
    return this.hydrateProducts(this.prisma, cart);
  }

  async abandon(
    shopId: string,
    cartId: string,
    staffId: string,
    stationId: string,
  ) {
    this.logger.log(`Manually abandoning cart ${cartId} in shop ${shopId}`);
    const activeKey = `${shopId}:${staffId}:${stationId}`;

    return this.prisma.$transaction(async (tx) => {
      // Scope the mutation to the authenticated cashier and their station so
      // one till cannot reset another till's active sale.
      const cart = await tx.cart.findFirst({
        where: {
          id: cartId,
          shopId,
          staffId,
          stationId,
          activeKey,
          status: CartStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!cart) throw new NotFoundException('Active cart not found');

      // Cart items are only working data. ABANDONED retains the cart lifecycle
      // record, while clearing activeKey lets the next scan create a new cart.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return tx.cart.update({
        where: { id: cart.id },
        data: {
          status: CartStatus.ABANDONED,
          activeKey: null,
          updatedAt: new Date(),
        },
      });
    });
  }

  async applyDiscount(
    shopId: string,
    cartId: string,
    cartItemId: string,
    staffId: string,
    stationId: string,
    type: DiscountType,
    value: Prisma.Decimal,
    reason?: string,
  ) {
    this.logger.log(`Applying ${type} discount to cart item ${cartItemId}`);
    const activeKey = `${shopId}:${staffId}:${stationId}`;

    return this.prisma.$transaction(
      async (tx) => {
        const item = await tx.cartItem.findFirst({
          where: {
            id: cartItemId,
            cartId,
            cart: {
              shopId,
              staffId,
              stationId,
              activeKey,
              status: CartStatus.ACTIVE,
            },
          },
          include: { cart: { select: { id: true } } },
        });
        if (!item) throw new NotFoundException('Active cart item not found');

        if (type === DiscountType.PERCENT && value.greaterThan(100)) {
          throw new ConflictException('Percentage discount cannot exceed 100%');
        }
        if (
          type === DiscountType.FLAT &&
          value.greaterThan(item.originalUnitPrice)
        ) {
          throw new ConflictException(
            'Flat discount cannot exceed the unit price',
          );
        }

        const finalUnitPrice = (
          type === DiscountType.PERCENT
            ? item.originalUnitPrice
                .mul(new Prisma.Decimal(100).sub(value))
                .div(100)
            : item.originalUnitPrice.sub(value)
        ).toDecimalPlaces(2);

        // Services have no cost-price floor. Product floors are computed only on
        // the server from the explicit minPrice or the configured margin fallback.
        let floor = new Prisma.Decimal(0);
        if (item.itemType === ItemType.PRODUCT) {
          const product = await tx.product.findFirst({
            where: { id: item.itemId, shopId },
            include: {
              shop: {
                select: { company: { select: { defaultMinMarginPct: true } } },
              },
            },
          });
          if (!product) throw new NotFoundException('Product not found');
          const margin = new Prisma.Decimal(
            product.minMarginPct ?? product.shop.company.defaultMinMarginPct,
          );
          floor =
            product.minPrice ??
            product.costPrice.mul(margin.div(100).add(1)).toDecimalPlaces(2);
        }
        const belowFloor = finalUnitPrice.lessThan(floor);
        const cleanedReason = reason?.trim();
        if (belowFloor && !cleanedReason) {
          throw new ConflictException(
            'A reason is required when the discount is below the minimum price',
          );
        }

        await tx.cartItem.update({
          where: { id: item.id },
          data: {
            discountType: type,
            discountValue: value,
            finalUnitPrice,
            belowFloor,
            discountReason: cleanedReason || null,
            discountAppliedById: staffId,
            surplusUnitAmount: new Prisma.Decimal(0),
            surplusReason: null,
            surplusAppliedById: null,
          },
        });
        await tx.cart.update({
          where: { id: cartId },
          data: { updatedAt: new Date() },
        });

        if (belowFloor) {
          await tx.notification.create({
            data: {
              shopId,
              type: NotificationType.BELOW_FLOOR_DISCOUNT,
              message: `Below-floor discount applied to cart item ${item.id}`,
              metadata: {
                cartId,
                cartItemId: item.id,
                staffId,
                floor: floor.toString(),
                finalUnitPrice: finalUnitPrice.toString(),
                reason: cleanedReason,
              },
            },
          });
        }

        const cart = await tx.cart.findUniqueOrThrow({
          where: { id: cartId },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        });
        return this.hydrateProducts(tx, cart);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async applyUpsell(shopId: string, cartId: string, cartItemId: string, staffId: string, stationId: string, negotiatedUnitPrice: Prisma.Decimal, reason?: string) {
    this.logger.log(`Applying negotiated upsell price to cart item ${cartItemId}`);
    const activeKey = `${shopId}:${staffId}:${stationId}`;
    return await this.prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirst({
        where: { id: cartItemId, cartId, itemType: ItemType.PRODUCT, cart: { shopId, staffId, stationId, activeKey, status: CartStatus.ACTIVE } },
      });
      if (!item) throw new NotFoundException('Active product cart item not found');
      if (!negotiatedUnitPrice.greaterThan(item.originalUnitPrice))
        throw new ConflictException('Negotiated price must be higher than the catalogue price');

      await tx.cartItem.update({
        where: { id: item.id },
        data: {
          finalUnitPrice: negotiatedUnitPrice.toDecimalPlaces(2),
          surplusUnitAmount: negotiatedUnitPrice.sub(item.originalUnitPrice).toDecimalPlaces(2),
          surplusReason: reason?.trim() || null,
          surplusAppliedById: staffId,
          discountType: null,
          discountValue: null,
          discountReason: null,
          discountAppliedById: null,
          belowFloor: false,
        },
      });
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
      const cart = await tx.cart.findUniqueOrThrow({ where: { id: cartId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
      return await this.hydrateProducts(tx, cart);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async checkout(
    shopId: string,
    cartId: string,
    staffId: string,
    stationId: string,
    customerId?: string,
    settlement: 'PAY_NOW' | 'CREDIT' = 'PAY_NOW',
    dueDate?: Date,
    creditNote?: string,
  ) {
    this.logger.log(`Checking out active cart in shop ${shopId}`);

    return this.prisma.$transaction(
      async (tx) => {
        // The cart identity includes the authenticated staff and physical/browser
        // station. This prevents one cashier from checking out another till's cart.
        const activeKey = `${shopId}:${staffId}:${stationId}`;
        const cart = await tx.cart.findFirst({
          where: {
            id: cartId,
            activeKey,
            shopId,
            staffId,
            stationId,
            status: CartStatus.ACTIVE,
          },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        });
        if (!cart) throw new NotFoundException('Active cart not found');
        if (cart.items.length === 0)
          throw new ConflictException('Cannot checkout an empty cart');

        // Shop ownership and Company VAT are reloaded inside the transaction.
        // VAT and tenancy are therefore never accepted from the browser.
        const shop = await tx.shop.findUniqueOrThrow({
          where: { id: shopId },
          select: { companyId: true, company: { select: { vatPct: true } } },
        });
        let customer: { id: string; creditLimit: Prisma.Decimal; creditAccount: { currentBalance: Prisma.Decimal } | null } | null = null;
        if (customerId) {
          customer = await tx.customer.findFirst({
            where: { id: customerId, companyId: shop.companyId },
            select: { id: true, creditLimit: true, creditAccount: { select: { currentBalance: true } } },
          });
          if (!customer)
            throw new NotFoundException('Customer not found in this company');
        }
        if (settlement === 'CREDIT' && !customer)
          throw new ConflictException('Select a customer before creating a credit sale');

        const productIds = cart.items
          .filter((item) => item.itemType === ItemType.PRODUCT)
          .map((item) => item.itemId);
        const serviceIds = cart.items
          .filter((item) => item.itemType === ItemType.SERVICE)
          .map((item) => item.itemId);
        const [products, services] = await Promise.all([
          tx.product.findMany({
            where: { id: { in: productIds }, shopId, isActive: true },
            select: { id: true },
          }),
          tx.service.findMany({
            where: { id: { in: serviceIds }, shopId, isActive: true },
            select: { id: true },
          }),
        ]);
        if (products.length !== productIds.length)
          throw new ConflictException('A cart product is missing or inactive');
        if (services.length !== serviceIds.length)
          throw new ConflictException('A cart service is missing or inactive');

        // CartItem prices are server-created snapshots. We calculate totals again
        // here rather than accepting subtotal, VAT, or total from checkout input.
        const lineSnapshots = cart.items.map((item) => ({
          itemType: item.itemType,
          itemId: item.itemId,
          quantity: item.quantity,
          originalUnitPrice: item.originalUnitPrice,
          discountType: item.discountType,
          discountValue: item.discountValue,
          finalUnitPrice: item.finalUnitPrice,
          lineTotal: item.finalUnitPrice.mul(item.quantity).toDecimalPlaces(2),
          belowFloor: item.belowFloor,
          discountReason: item.discountReason,
          discountAppliedById: item.discountAppliedById,
          surplusUnitAmount: item.surplusUnitAmount ?? new Prisma.Decimal(0),
          surplusTotal: (item.surplusUnitAmount ?? new Prisma.Decimal(0)).mul(item.quantity).toDecimalPlaces(2),
          surplusReason: item.surplusReason,
          surplusAppliedById: item.surplusAppliedById,
        }));
        const total = lineSnapshots
          .reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0))
          .toDecimalPlaces(2);
        const vatPct = new Prisma.Decimal(shop.company.vatPct);
        const vatAmount = vatPct.isZero()
          ? new Prisma.Decimal(0)
          : total.mul(vatPct).div(vatPct.add(100)).toDecimalPlaces(2);
        const subtotal = total.sub(vatAmount).toDecimalPlaces(2);
        const surplusTotal = lineSnapshots.reduce(
          (sum, line) => sum.add(line.surplusTotal),
          new Prisma.Decimal(0),
        ).toDecimalPlaces(2);

        if (settlement === 'CREDIT' && customer) {
          const currentBalance = customer.creditAccount?.currentBalance ?? new Prisma.Decimal(0);
          if (currentBalance.add(total).greaterThan(customer.creditLimit))
            throw new ConflictException('Customer credit limit would be exceeded');
        }

        // The order and its lines are immutable snapshots. Later catalog-price
        // edits cannot change what this customer was charged.
        const order = await tx.order.create({
          data: {
            shopId,
            staffId,
            ...(customerId ? { customerId } : {}),
            status: OrderStatus.OPEN,
            subtotal,
            vatAmount,
            total,
            amountPaid: new Prisma.Decimal(0),
            lineItems: { create: lineSnapshots },
          },
          select: { id: true },
        });

        // Checkout recognizes revenue once, regardless of whether settlement
        // happens now, through several payments, or later as customer credit.
        await this.accountSeeder.initializeInTransaction(tx, shop.companyId, shopId);
        await this.accounting.post(tx, {
          companyId: shop.companyId,
          shopId,
          recordedById: staffId,
          eventType: settlement === 'CREDIT' ? AccountingEventType.CREDIT_SALE : AccountingEventType.SALE,
          transactionDate: new Date(),
          description: `Sale recognized for order ${order.id}`,
          source: { type: AccountingSourceType.ORDER, id: order.id },
          lines: [
            ...saleRecognitionLines({ total, subtotal, vatAmount, lineItems: lineSnapshots }),
            ...(surplusTotal.isPositive()
              ? [
                  { purpose: AccountPurpose.CASHIER_SURPLUS_EXPENSE, side: JournalSide.DEBIT, amount: surplusTotal },
                  { purpose: AccountPurpose.CASHIER_SURPLUS_PAYABLE, side: JournalSide.CREDIT, amount: surplusTotal },
                ]
              : []),
          ],
        });

        // Credit is a receivable, not money received. At credit checkout we
        // allocate the order to the customer account automatically so the
        // cashier does not have to submit a fake cash/M-Pesa payment.
        if (settlement === 'CREDIT' && customer) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              method: PaymentMethod.CREDIT,
              channel: PaymentChannel.MANUAL,
              amount: total,
              status: PaymentStatus.CONFIRMED,
              recordedById: staffId,
              confirmedAt: new Date(),
            },
          });
          await tx.creditTransaction.create({
            data: {
              customerId: customer.id,
              orderId: order.id,
              type: CreditTransactionType.CREDIT_SALE,
              amount: total,
              ...(dueDate ? { dueDate } : {}),
              ...(creditNote ? { note: creditNote } : {}),
              recordedById: staffId,
            },
          });
          await tx.creditAccountCache.upsert({
            where: { customerId: customer.id },
            create: { customerId: customer.id, currentBalance: total },
            update: { currentBalance: { increment: total } },
          });
          await tx.order.update({
            where: { id: order.id },
            data: { amountPaid: total, status: OrderStatus.PAID },
          });
        }

        // Stock is decremented conditionally. If two tills race for the final
        // unit, only one update succeeds; the losing checkout fully rolls back.
        for (const item of cart.items) {
          if (item.itemType !== ItemType.PRODUCT) continue;
          const updated = await tx.stockCache.updateMany({
            where: {
              productId: item.itemId,
              currentQuantity: { gte: item.quantity },
            },
            data: { currentQuantity: { decrement: item.quantity } },
          });
          if (updated.count !== 1)
            throw new ConflictException(
              `Insufficient stock for product ${item.itemId}`,
            );
          await tx.stockMovement.create({
            data: {
              productId: item.itemId,
              quantityDelta: -item.quantity,
              type: StockMovementType.SALE,
              referenceId: order.id,
              createdById: staffId,
              note: `Sold on order ${order.id}`,
            },
          });
        }

        // CartItem rows are transient working data. OrderLineItem rows are now
        // the permanent audit record, so the cart lines can be removed safely.
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.update({
          where: { id: cart.id },
          data: {
            status: CartStatus.COMPLETED,
            orderId: order.id,
            activeKey: null,
          },
        });

        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: {
            lineItems: true,
            customer: { select: { id: true, name: true, phone: true } },
            payments: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async hydrateProducts(
    client: Prisma.TransactionClient | PrismaService,
    cart: {
      items: Array<{ itemType: ItemType; itemId: string }>;
      [key: string]: unknown;
    },
  ) {
    const productIds = cart.items
      .filter((item) => item.itemType === ItemType.PRODUCT)
      .map((item) => item.itemId);
    const products = await client.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, barcode: true, isActive: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return {
      ...cart,
      items: cart.items.map((item) => ({
        ...item,
        product:
          item.itemType === ItemType.PRODUCT
            ? (byId.get(item.itemId) ?? null)
            : null,
      })),
    };
  }
}
