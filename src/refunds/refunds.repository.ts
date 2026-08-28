import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountPurpose, AccountingEventType, AccountingSourceType, CreditTransactionType, ItemType, JournalSide, OrderRefundStatus, PaymentMethod, PaymentStatus, Prisma, RefundDisposition, StockMovementType } from 'generated/prisma/client';
import { AccountSeederService } from 'src/accounting/account-seeder.service';
import { AccountingPostingService } from 'src/accounting/accounting-posting.service';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { CreateRefundDto } from './dto/create-refund.dto';

type Tx = Prisma.TransactionClient;
type LoadedOrder = Awaited<ReturnType<RefundsRepository['loadRefundableOrder']>>;
type ValidLine = { id: string; itemId: string; itemType: ItemType; quantity: number; disposition: RefundDisposition; amount: Prisma.Decimal; surplusReversed: Prisma.Decimal };
type Allocation = { method: PaymentMethod; amount: Prisma.Decimal; referenceCode?: string };

@Injectable()
export class RefundsRepository {
  private readonly logger = new Logger(RefundsRepository.name);
  constructor(private readonly prisma: PrismaService, private readonly accountSeeder: AccountSeederService, private readonly accounting: AccountingPostingService) {}

  async process(shopId: string, orderId: string, userId: string, data: CreateRefundDto) {
    this.logger.log(`Processing refund for order ${orderId} in shop ${shopId}`);
    return await this.prisma.$transaction(async (tx) => {
      const order = await this.loadRefundableOrder(tx, shopId, orderId);
      const lines = this.validateRefundLines(order, data);
      const total = lines.reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0)).toDecimalPlaces(2);
      this.assertOrderRefundAvailable(order, total);
      const allocations = this.validateAllocations(data, total);
      await this.assertAllocationAvailability(tx, order, allocations);
      await this.assertMpesaReferencesAvailable(tx, allocations);
      const refund = await this.createRefundRecord(tx, order.id, userId, data.reason, total, lines);
      await this.restoreReturnedStock(tx, shopId, refund.id, userId, data.reason, lines);
      await this.reduceCustomerCredit(tx, order, refund.id, userId, allocations);
      await this.createRefundPayments(tx, refund.id, userId, allocations);
      await this.postRefund(tx, shopId, order, refund.id, userId, total, allocations);
      await this.updateOrderRefundSummary(tx, order.id, order.total, order.refundedAmount, total);
      return this.loadRefundResult(tx, refund.id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private loadRefundableOrder(tx: Tx, shopId: string, orderId: string) {
    return tx.order.findFirst({
      where: { id: orderId, shopId },
      include: {
        lineItems: { include: { refundLineItems: true } },
        payments: { where: { status: PaymentStatus.CONFIRMED } },
        customer: { include: { creditAccount: true } },
        refunds: { include: { payments: true, creditTransactions: true } },
      },
    }).then((order) => {
      if (!order) throw new NotFoundException('Order not found');
      if (!order.payments.length) throw new ConflictException('An unpaid order must be cancelled, not refunded');
      if (order.refundStatus === OrderRefundStatus.FULL) throw new ConflictException('Order is already fully refunded');
      return order;
    });
  }

  private validateRefundLines(order: NonNullable<LoadedOrder>, data: CreateRefundDto): ValidLine[] {
    if (new Set(data.lines.map((line) => line.orderLineItemId)).size !== data.lines.length) throw new ConflictException('Each order line may appear only once');
    return data.lines.map((requested) => {
      const line = order.lineItems.find((candidate) => candidate.id === requested.orderLineItemId);
      if (!line) throw new ConflictException(`Order line ${requested.orderLineItemId} does not belong to this order`);
      const alreadyRefunded = line.refundLineItems.reduce((sum, item) => sum + item.quantity, 0);
      if (requested.quantity > line.quantity - alreadyRefunded) throw new ConflictException(`Refund quantity exceeds the remaining quantity for line ${line.id}`);
      if (line.itemType === ItemType.SERVICE && requested.disposition !== RefundDisposition.NOT_RETURNED) throw new ConflictException('Services must use NOT_RETURNED because they do not affect stock');
      const amount = new Prisma.Decimal(requested.refundAmount);
      const amountAlreadyRefunded = line.refundLineItems.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      const amountRemaining = line.lineTotal.sub(amountAlreadyRefunded);
      if (amount.greaterThan(amountRemaining)) throw new ConflictException(`Refund amount exceeds the remaining value for line ${line.id}`);
      const surplusAlreadyReversed = line.refundLineItems.reduce((sum, item) => sum.add(item.surplusReversed), new Prisma.Decimal(0));
      // Surplus belongs to units that remain sold. When a physical unit is
      // returned, reverse that unit's full surplus even when the owner chooses
      // to refund less than the original selling price.
      const returnedUnitSurplus = line.surplusUnitAmount.mul(requested.quantity).toDecimalPlaces(2);
      const surplusReversed = Prisma.Decimal.min(returnedUnitSurplus, line.surplusTotal.sub(surplusAlreadyReversed));
      return { id: line.id, itemId: line.itemId, itemType: line.itemType, quantity: requested.quantity, disposition: requested.disposition as RefundDisposition, amount, surplusReversed };
    });
  }

  private assertOrderRefundAvailable(order: NonNullable<LoadedOrder>, total: Prisma.Decimal) {
    if (order.refundedAmount.add(total).greaterThan(order.total)) throw new ConflictException('Refund exceeds the order total');
  }

  private validateAllocations(data: CreateRefundDto, total: Prisma.Decimal): Allocation[] {
    const allocations = data.allocations.map((item) => ({ method: item.method as PaymentMethod, amount: new Prisma.Decimal(item.amount), ...(item.referenceCode?.trim() ? { referenceCode: item.referenceCode.trim().toUpperCase() } : {}) }));
    const allocated = allocations.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)).toDecimalPlaces(2);
    if (!allocated.equals(total)) throw new ConflictException(`Refund allocations ${allocated} must equal refund total ${total}`);
    if (allocations.some((item) => item.method === PaymentMethod.MPESA && !item.referenceCode)) throw new ConflictException('An M-Pesa refund reference is required');
    return allocations;
  }

  private async assertAllocationAvailability(tx: Tx, order: NonNullable<LoadedOrder>, allocations: Allocation[]) {
    for (const method of [PaymentMethod.CASH, PaymentMethod.MPESA, PaymentMethod.CREDIT]) {
      const requested = allocations.filter((item) => item.method === method).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      const received = order.payments.filter((item) => item.method === method).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      const previous = method === PaymentMethod.CREDIT
        ? order.refunds.flatMap((refund) => refund.creditTransactions).reduce((sum, item) => sum.add(item.amount.abs()), new Prisma.Decimal(0))
        : order.refunds.flatMap((refund) => refund.payments).filter((item) => item.method === method && item.status === PaymentStatus.CONFIRMED).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      if (requested.greaterThan(received.sub(previous))) throw new ConflictException(`${method} refund allocation exceeds the remaining original ${method} allocation`);
    }
    const credit = allocations.filter((item) => item.method === PaymentMethod.CREDIT).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    if (credit.greaterThan(0) && (!order.customerId || !order.customer?.creditAccount || credit.greaterThan(order.customer.creditAccount.currentBalance))) throw new ConflictException('Credit refund exceeds the customer’s current balance');
  }

  private async assertMpesaReferencesAvailable(tx: Tx, allocations: Allocation[]) {
    for (const item of allocations.filter((allocation) => allocation.method === PaymentMethod.MPESA)) {
      const duplicate = await tx.refundPayment.findFirst({ where: { method: PaymentMethod.MPESA, referenceCode: { equals: item.referenceCode!, mode: 'insensitive' }, status: { in: [PaymentStatus.PENDING, PaymentStatus.CONFIRMED] } }, select: { id: true } });
      if (duplicate) throw new ConflictException('This M-Pesa refund reference is already in use');
    }
  }

  private createRefundRecord(tx: Tx, orderId: string, userId: string, reason: string, total: Prisma.Decimal, lines: ValidLine[]) {
    return tx.refund.create({ data: { orderId, staffId: userId, reason: reason.trim(), totalAmount: total, lineItems: { create: lines.map((line) => ({ orderLineItemId: line.id, quantity: line.quantity, amount: line.amount, disposition: line.disposition, surplusReversed: line.surplusReversed })) } } });
  }

  private async restoreReturnedStock(tx: Tx, shopId: string, refundId: string, userId: string, reason: string, lines: ValidLine[]) {
    for (const line of lines.filter((item) => item.itemType === ItemType.PRODUCT && item.disposition === RefundDisposition.RESTOCK)) {
      const updated = await tx.stockCache.updateMany({ where: { productId: line.itemId, product: { shopId } }, data: { currentQuantity: { increment: line.quantity } } });
      if (updated.count !== 1) throw new ConflictException(`Stock cache is missing for product ${line.itemId}`);
      await tx.stockMovement.create({ data: { productId: line.itemId, quantityDelta: line.quantity, type: StockMovementType.REFUND, referenceId: refundId, createdById: userId, note: `Customer refund: ${reason.trim()}` } });
    }
  }

  private async reduceCustomerCredit(tx: Tx, order: NonNullable<LoadedOrder>, refundId: string, userId: string, allocations: Allocation[]) {
    const amount = allocations.filter((item) => item.method === PaymentMethod.CREDIT).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    if (amount.isZero()) return;
    const updated = await tx.creditAccountCache.updateMany({ where: { customerId: order.customerId!, currentBalance: { gte: amount } }, data: { currentBalance: { decrement: amount } } });
    if (updated.count !== 1) throw new ConflictException('Customer credit balance changed; retry the refund');
    await tx.creditTransaction.create({ data: { customerId: order.customerId!, orderId: order.id, refundId, type: CreditTransactionType.REFUND, amount: amount.negated(), note: `Credit reversed by refund ${refundId}`, recordedById: userId } });
  }

  private async createRefundPayments(tx: Tx, refundId: string, userId: string, allocations: Allocation[]) {
    const payments = allocations.filter((item) => item.method === PaymentMethod.CASH || item.method === PaymentMethod.MPESA);
    if (!payments.length) return;
    await tx.refundPayment.createMany({ data: payments.map((item) => ({ refundId, method: item.method, amount: item.amount, status: PaymentStatus.CONFIRMED, referenceCode: item.referenceCode, recordedById: userId, confirmedAt: new Date() })) });
  }

  private updateOrderRefundSummary(tx: Tx, orderId: string, orderTotal: Prisma.Decimal, previous: Prisma.Decimal, current: Prisma.Decimal) {
    const refundedAmount = previous.add(current).toDecimalPlaces(2);
    return tx.order.update({ where: { id: orderId }, data: { refundedAmount, refundStatus: refundedAmount.equals(orderTotal) ? OrderRefundStatus.FULL : OrderRefundStatus.PARTIAL } });
  }

  private loadRefundResult(tx: Tx, refundId: string) {
    return tx.refund.findUniqueOrThrow({ where: { id: refundId }, include: { staff: { select: { id: true, name: true } }, lineItems: true, payments: { include: { recordedBy: { select: { id: true, name: true } } } }, creditTransactions: true, order: { select: { id: true, total: true, refundedAmount: true, refundStatus: true } } } });
  }

  private async postRefund(tx: Tx, shopId: string, order: NonNullable<LoadedOrder>, refundId: string, userId: string, total: Prisma.Decimal, allocations: Allocation[]) {
    const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId }, select: { companyId: true } });
    await this.accountSeeder.initializeInTransaction(tx, shop.companyId, shopId);
    const vat = order.total.isZero() ? new Prisma.Decimal(0) : total.mul(order.vatAmount).div(order.total).toDecimalPlaces(2);
    const net = total.sub(vat);
    const lines: Array<{ purpose: AccountPurpose; side: JournalSide; amount: Prisma.Decimal }> = [
      ...(net.isPositive() ? [{ purpose: AccountPurpose.SALES_RETURNS, side: JournalSide.DEBIT, amount: net }] : []),
      ...(vat.isPositive() ? [{ purpose: AccountPurpose.VAT_PAYABLE, side: JournalSide.DEBIT, amount: vat }] : []),
      ...allocations.map((allocation) => ({
        purpose: allocation.method === PaymentMethod.CASH
          ? AccountPurpose.CASH_ON_HAND
          : allocation.method === PaymentMethod.MPESA
            ? AccountPurpose.MPESA
            : AccountPurpose.CUSTOMER_RECEIVABLE,
        side: JournalSide.CREDIT,
        amount: allocation.amount,
      })),
    ];
    const currentSurplusReversed = await tx.refundLineItem.aggregate({ where: { refundId }, _sum: { surplusReversed: true } });
    const reversal = currentSurplusReversed._sum.surplusReversed ?? new Prisma.Decimal(0);
    if (reversal.isPositive()) {
      lines.push(
        { purpose: AccountPurpose.CASHIER_SURPLUS_PAYABLE, side: JournalSide.DEBIT, amount: reversal },
        { purpose: AccountPurpose.CASHIER_SURPLUS_EXPENSE, side: JournalSide.CREDIT, amount: reversal },
      );
    }
    await this.accounting.post(tx, {
      companyId: shop.companyId, shopId, recordedById: userId,
      eventType: AccountingEventType.REFUND, transactionDate: new Date(),
      description: `Refund for order ${order.id}`,
      source: { type: AccountingSourceType.REFUND, id: refundId }, lines,
    });
  }
}
