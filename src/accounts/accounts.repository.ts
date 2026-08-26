import { Injectable, Logger } from '@nestjs/common';
import { CreditTransactionType, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class AccountsRepository {
  private readonly logger = new Logger(AccountsRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  async dailyRecords(shopId: string, start: Date, end: Date, openingStart: Date, openingEnd: Date) {
    this.logger.log(`Loading account records for shop ${shopId}`);
    const [orders, payments, credits, expenses, openings] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where: { shopId, status: { not: OrderStatus.CANCELLED }, createdAt: { gte: start, lt: end } }, select: { total: true, createdAt: true } }),
      this.prisma.payment.findMany({ where: { order: { shopId }, status: PaymentStatus.CONFIRMED, method: { in: [PaymentMethod.CASH, PaymentMethod.MPESA] }, confirmedAt: { gte: start, lt: end } }, select: { method: true, amount: true, confirmedAt: true } }),
      this.prisma.creditTransaction.findMany({ where: { type: CreditTransactionType.CREDIT_SALE, order: { shopId }, createdAt: { gte: start, lt: end } }, select: { orderId: true, amount: true, createdAt: true } }),
      this.prisma.expense.findMany({ where: { shopId, createdAt: { gte: start, lt: end } }, select: { amount: true, paymentMethod: true, createdAt: true } }),
      this.prisma.shopDailyAccount.findMany({ where: { shopId, businessDate: { gte: openingStart, lt: openingEnd } }, select: { businessDate: true, openingCash: true, recordedBy: { select: { id: true, name: true } }, updatedAt: true } }),
    ]);
    return { orders, payments, credits, expenses, openings };
  }

  setOpeningCash(shopId: string, userId: string, businessDate: Date, openingCash: Prisma.Decimal) {
    this.logger.log(`Setting opening cash for shop ${shopId} on ${businessDate.toISOString()}`);
    return this.prisma.shopDailyAccount.upsert({
      where: { shopId_businessDate: { shopId, businessDate } },
      create: { shopId, businessDate, openingCash, recordedById: userId },
      update: { openingCash, recordedById: userId },
      select: { businessDate: true, openingCash: true, updatedAt: true, recordedBy: { select: { id: true, name: true } } },
    });
  }
}
