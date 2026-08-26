import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ItemType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  StockMovementType,
} from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';

export const orderReadInclude = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  staff: { select: { id: true, name: true, email: true } },
  lineItems: { orderBy: { createdAt: 'asc' as const } },
  payments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      recordedBy: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
    },
  },
  refunds: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      staff: { select: { id: true, name: true } },
      lineItems: true,
      payments: {
        include: { recordedBy: { select: { id: true, name: true } } },
      },
      creditTransactions: true,
    },
  },
  cancellation: {
    include: { cancelledBy: { select: { id: true, name: true } } },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersRepository {
  private readonly logger = new Logger(OrdersRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  find(shopId: string, orderId: string) {
    this.logger.log(`Retrieving order ${orderId} in shop ${shopId}`);
    return this.prisma.order.findFirst({
      where: { id: orderId, shopId },
      include: orderReadInclude,
    });
  }

  async history(shopId: string, query: OrderHistoryQueryDto) {
    this.logger.log(`Retrieving order history in shop ${shopId}`);
    // HTTP query parameters are strings at runtime unless Nest transforms the
    // DTO. Normalize again at the persistence boundary so Prisma can never
    // receive `take: "25"` or a negative/unbounded pagination value.
    const requestedPage = Number(query.page ?? 1);
    const requestedLimit = Number(query.limit ?? 25);
    const page = Number.isSafeInteger(requestedPage)
      ? Math.max(1, requestedPage)
      : 1;
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 25;
    const where = this.historyWhere(shopId, query);

    // Count and rows use the exact same predicate, so pagination metadata
    // cannot disagree with the records returned to the cashier.
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderReadInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, totalItems, page, limit };
  }

  async itemNames(lineItems: Array<{ itemType: string; itemId: string }>) {
    const productIds = lineItems
      .filter((line) => line.itemType === 'PRODUCT')
      .map((line) => line.itemId);
    const serviceIds = lineItems
      .filter((line) => line.itemType === 'SERVICE')
      .map((line) => line.itemId);
    const [products, services] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, barcode: true },
      }),
      this.prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true },
      }),
    ]);
    return new Map<string, { name: string; barcode?: string | null }>([
      ...products.map((item) => [item.id, item] as const),
      ...services.map((item) => [item.id, item] as const),
    ]);
  }

  async cancel(shopId: string, orderId: string, userId: string, reason: string) {
    this.logger.log(`Cancelling unpaid order ${orderId} in shop ${shopId}`);
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, shopId },
        include: { lineItems: true, payments: true, cancellation: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CANCELLED || order.cancellation)
        throw new ConflictException('Order is already cancelled');
      const confirmedAmount = order.payments
        .filter((payment) => payment.status === PaymentStatus.CONFIRMED)
        .reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
      if (confirmedAmount.greaterThan(0))
        throw new ConflictException('Orders with confirmed payments must use the refund workflow');

      const cancellation = await tx.orderCancellation.create({
        data: { orderId, cancelledById: userId, reason },
      });
      for (const line of order.lineItems.filter((item) => item.itemType === ItemType.PRODUCT)) {
        const stock = await tx.stockCache.updateMany({
          where: { productId: line.itemId, product: { shopId } },
          data: { currentQuantity: { increment: line.quantity } },
        });
        if (stock.count !== 1)
          throw new ConflictException(`Stock cache is missing for product ${line.itemId}`);
        await tx.stockMovement.create({
          data: {
            productId: line.itemId,
            quantityDelta: line.quantity,
            type: StockMovementType.REFUND,
            referenceId: cancellation.id,
            createdById: userId,
            note: `Order cancellation: ${reason}`,
          },
        });
      }
      await tx.payment.updateMany({
        where: { orderId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.CANCELLED, failureReason: `Order cancelled: ${reason}` },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED, amountPaid: new Prisma.Decimal(0) },
      });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderReadInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private historyWhere(
    shopId: string,
    query: OrderHistoryQueryDto,
  ): Prisma.OrderWhereInput {
    const confirmedCredit: Prisma.PaymentWhereInput = {
      method: PaymentMethod.CREDIT,
      status: PaymentStatus.CONFIRMED,
    };
    const confirmedNormal: Prisma.PaymentWhereInput = {
      method: { in: [PaymentMethod.CASH, PaymentMethod.MPESA] },
      status: PaymentStatus.CONFIRMED,
    };
    const saleType =
      query.saleType === 'CREDIT'
        ? {
            payments: { some: confirmedCredit },
            AND: [{ payments: { none: confirmedNormal } }],
          }
        : query.saleType === 'MIXED'
          ? {
              AND: [
                { payments: { some: confirmedCredit } },
                { payments: { some: confirmedNormal } },
              ],
            }
          : query.saleType === 'NORMAL'
            ? { payments: { none: confirmedCredit } }
            : {};
    const q = query.q?.trim();
    return {
      shopId,
      ...(query.status ? { status: query.status as OrderStatus } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: 'insensitive' } },
              { customer: { name: { contains: q, mode: 'insensitive' } } },
              { staff: { name: { contains: q, mode: 'insensitive' } } },
              {
                payments: {
                  some: { referenceCode: { contains: q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
      ...saleType,
    };
  }
}
