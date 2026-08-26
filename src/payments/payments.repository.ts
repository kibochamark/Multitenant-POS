import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreditTransactionType, OrderStatus, PaymentChannel, PaymentMethod, PaymentStatus, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

const orderResultInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  lineItems: true,
  payments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      recordedBy: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class PaymentsRepository {
  private readonly logger = new Logger(PaymentsRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  getOrder(shopId: string, orderId: string) {
    this.logger.log(`Getting order ${orderId} in shop ${shopId}`);
    return this.prisma.order.findFirst({
      where: { id: orderId, shopId },
      include: orderResultInclude,
    });
  }

  recordCash(shopId: string, orderId: string, userId: string, amount: Prisma.Decimal) {
    this.logger.log(`Recording cash payment for order ${orderId}`);
    return this.prisma.$transaction(async (tx) => {
      const order = await this.loadPayableOrder(tx, shopId, orderId);
      await this.assertAllocationAvailable(tx, order.id, order.total, amount);

      // Cash is physically received at the till, so it needs no later
      // reconciliation and becomes confirmed immediately.
      const payment = await tx.payment.create({
        data: {
          orderId,
          method: PaymentMethod.CASH,
          channel: PaymentChannel.MANUAL,
          amount,
          status: PaymentStatus.CONFIRMED,
          recordedById: userId,
          confirmedAt: new Date(),
        },
      });
      const updatedOrder = await this.addConfirmedAmount(tx, order, amount);
      return { payment, order: updatedOrder };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  recordManualMpesa(
    shopId: string,
    orderId: string,
    userId: string,
    amount: Prisma.Decimal,
    referenceCode: string,
  ) {
    this.logger.log(`Recording trusted M-Pesa payment for order ${orderId}`);
    return this.prisma.$transaction(async (tx) => {
      const order = await this.loadPayableOrder(tx, shopId, orderId);
      await this.assertAllocationAvailable(tx, order.id, order.total, amount);
      const duplicate = await tx.payment.findFirst({
        where: {
          method: PaymentMethod.MPESA,
          referenceCode: { equals: referenceCode, mode: 'insensitive' },
          status: { in: [PaymentStatus.PENDING, PaymentStatus.CONFIRMED] },
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('This M-Pesa reference code is already in use');

      // A submitted reference is trusted immediately by the current business
      // rule. Global duplicate-reference protection prevents double recording.
      const payment = await tx.payment.create({
        data: {
          orderId,
          method: PaymentMethod.MPESA,
          channel: PaymentChannel.MANUAL,
          amount,
          status: PaymentStatus.CONFIRMED,
          referenceCode,
          recordedById: userId,
          confirmedAt: new Date(),
        },
      });
      const updatedOrder = await this.refreshOrderPaymentState(tx, orderId);
      return {
        payment,
        notificationDeliveryIds: [],
        order: updatedOrder,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  verifyManualMpesa(
    shopId: string,
    orderId: string,
    paymentId: string,
    verifierId: string,
    result: 'CONFIRMED' | 'FAILED',
    reason?: string,
  ) {
    this.logger.log(`Verifying M-Pesa payment ${paymentId}`);
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          id: paymentId,
          orderId,
          order: { shopId },
          method: PaymentMethod.MPESA,
          channel: PaymentChannel.MANUAL,
          status: PaymentStatus.PENDING,
        },
        include: { order: true },
      });
      if (!payment) throw new NotFoundException('Pending M-Pesa payment not found');

      const now = new Date();
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: result === 'CONFIRMED' ? PaymentStatus.CONFIRMED : PaymentStatus.FAILED,
          verifiedById: verifierId,
          verifiedAt: now,
          ...(result === 'CONFIRMED' ? { confirmedAt: now, failureReason: null } : { failureReason: reason?.trim() || 'Reference could not be verified' }),
        },
      });
      await this.refreshOrderPaymentState(tx, orderId);
      return {
        payment: updatedPayment,
        order: await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderResultInclude }),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  recordCredit(
    shopId: string,
    orderId: string,
    userId: string,
    amount: Prisma.Decimal,
    dueDate?: Date,
    note?: string,
  ) {
    this.logger.log(`Recording credit settlement for order ${orderId}`);
    return this.prisma.$transaction(async (tx) => {
      const order = await this.loadPayableOrder(tx, shopId, orderId);
      if (!order.customerId) throw new ConflictException('A customer is required for a credit sale');
      await this.assertAllocationAvailable(tx, order.id, order.total, amount);
      const customer = await tx.customer.findUniqueOrThrow({
        where: { id: order.customerId },
        include: { creditAccount: true },
      });
      const balance = customer.creditAccount?.currentBalance ?? new Prisma.Decimal(0);
      if (balance.add(amount).greaterThan(customer.creditLimit)) {
        throw new ConflictException('Customer credit limit would be exceeded');
      }

      // CREDIT confirms the order allocation immediately, while the separate
      // append-only credit ledger records that no cash was collected.
      const payment = await tx.payment.create({
        data: {
          orderId,
          method: PaymentMethod.CREDIT,
          channel: PaymentChannel.MANUAL,
          amount,
          status: PaymentStatus.CONFIRMED,
          recordedById: userId,
          confirmedAt: new Date(),
        },
      });
      const creditTransaction = await tx.creditTransaction.create({
        data: {
          customerId: customer.id,
          orderId,
          type: CreditTransactionType.CREDIT_SALE,
          amount,
          ...(dueDate ? { dueDate } : {}),
          ...(note ? { note } : {}),
          recordedById: userId,
        },
      });
      await tx.creditAccountCache.upsert({
        where: { customerId: customer.id },
        create: { customerId: customer.id, currentBalance: amount },
        update: { currentBalance: { increment: amount } },
      });
      await this.addConfirmedAmount(tx, order, amount);
      return {
        payment,
        creditTransaction,
        order: await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderResultInclude }),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async loadPayableOrder(tx: Prisma.TransactionClient, shopId: string, orderId: string) {
    const order = await tx.order.findFirst({ where: { id: orderId, shopId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.CANCELLED) throw new ConflictException('Cancelled orders cannot receive payments');
    if (order.amountPaid.greaterThanOrEqualTo(order.total)) throw new ConflictException('Order is already fully paid');
    return order;
  }

  private async assertAllocationAvailable(tx: Prisma.TransactionClient, orderId: string, total: Prisma.Decimal, amount: Prisma.Decimal) {
    // Pending M-Pesa is included so cash/credit cannot consume money already
    // reserved by a reference that may later be confirmed.
    const allocated = await tx.payment.aggregate({
      where: { orderId, status: { in: [PaymentStatus.PENDING, PaymentStatus.CONFIRMED] } },
      _sum: { amount: true },
    });
    const existing = allocated._sum.amount ?? new Prisma.Decimal(0);
    if (existing.add(amount).greaterThan(total)) throw new ConflictException('Payment allocations exceed the order total');
  }

  private async addConfirmedAmount(tx: Prisma.TransactionClient, order: { id: string; total: Prisma.Decimal; amountPaid: Prisma.Decimal }, amount: Prisma.Decimal) {
    const amountPaid = order.amountPaid.add(amount).toDecimalPlaces(2);
    if (amountPaid.greaterThan(order.total)) throw new ConflictException('Confirmed payments exceed the order total');
    return this.refreshOrderPaymentState(tx, order.id);
  }

  private async refreshOrderPaymentState(tx: Prisma.TransactionClient, orderId: string) {
    const [order, confirmed, pendingCount] = await Promise.all([
      tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { total: true } }),
      tx.payment.aggregate({ where: { orderId, status: PaymentStatus.CONFIRMED }, _sum: { amount: true } }),
      tx.payment.count({ where: { orderId, status: PaymentStatus.PENDING } }),
    ]);
    const amountPaid = (confirmed._sum.amount ?? new Prisma.Decimal(0)).toDecimalPlaces(2);
    if (amountPaid.greaterThan(order.total)) throw new ConflictException('Confirmed payments exceed the order total');
    const status = amountPaid.equals(order.total)
      ? OrderStatus.PAID
      : pendingCount > 0
        ? OrderStatus.PENDING
        : amountPaid.greaterThan(0)
          ? OrderStatus.PARTIALLY_PAID
          : OrderStatus.OPEN;
    return tx.order.update({ where: { id: orderId }, data: { amountPaid, status }, include: orderResultInclude });
  }
}
