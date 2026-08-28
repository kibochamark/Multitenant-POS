import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { AccountPurpose, AccountingEventType, AccountingSourceType, CreditTransactionType, JournalSide, PaymentChannel, PaymentMethod, PaymentStatus, Prisma } from 'generated/prisma/client';
import { AccountSeederService } from 'src/accounting/account-seeder.service';
import { AccountingPostingService } from 'src/accounting/accounting-posting.service';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

const repaymentInclude = { recordedBy: { select: { id: true, name: true } }, verifiedBy: { select: { id: true, name: true } } } satisfies Prisma.CreditRepaymentInclude;

@Injectable()
export class CreditRepaymentsRepository {
  private readonly logger = new Logger(CreditRepaymentsRepository.name);
  constructor(private readonly prisma: PrismaService, private readonly accountSeeder: AccountSeederService, private readonly accounting: AccountingPostingService) {}

  account(companyId: string, customerId: string) {
    return this.prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true, name: true, creditLimit: true, creditAccount: true, creditTransactions: { orderBy: { createdAt: 'desc' }, take: 100, include: { recordedBy: { select: { id: true, name: true } }, order: { select: { id: true, total: true, createdAt: true } } } }, creditRepayments: { orderBy: { createdAt: 'desc' }, take: 100, include: repaymentInclude } } });
  }

  recordCash(companyId: string, shopId: string, customerId: string, userId: string, amount: Prisma.Decimal, note?: string) {
    this.logger.log(`Recording cash credit repayment for customer ${customerId}`);
    return this.prisma.$transaction(async (tx) => {
      const customer = await this.loadAccount(tx, companyId, customerId);
      await this.assertAvailable(tx, customerId, customer.creditAccount?.currentBalance ?? new Prisma.Decimal(0), amount);
      const repayment = await tx.creditRepayment.create({ data: { customerId, amount: amount.toNumber(), method: PaymentMethod.CASH, channel: PaymentChannel.MANUAL, status: PaymentStatus.CONFIRMED, recordedById: userId, confirmedAt: new Date(), note }, include: repaymentInclude });
      await this.applyConfirmed(tx, customerId, userId, amount, note ?? `Cash repayment ${repayment.id}`);
      await this.postRepayment(tx, companyId, shopId, userId, repayment.id, PaymentMethod.CASH, amount, repayment.confirmedAt);
      return repayment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  recordMpesa(companyId: string, shopId: string, customerId: string, userId: string, amount: Prisma.Decimal, referenceCode: string, note?: string) {
    this.logger.log(`Recording pending M-Pesa credit repayment for customer ${customerId}`);
    return this.prisma.$transaction(async (tx) => {
      const customer = await this.loadAccount(tx, companyId, customerId);
      await this.assertAvailable(tx, customerId, customer.creditAccount?.currentBalance ?? new Prisma.Decimal(0), amount);
      const [orderPayment, repayment] = await Promise.all([
        tx.payment.findFirst({ where: { method: PaymentMethod.MPESA, referenceCode: { equals: referenceCode, mode: 'insensitive' }, status: { in: [PaymentStatus.PENDING, PaymentStatus.CONFIRMED] } }, select: { id: true } }),
        tx.creditRepayment.findFirst({ where: { method: PaymentMethod.MPESA, referenceCode: { equals: referenceCode, mode: 'insensitive' }, status: { in: [PaymentStatus.PENDING, PaymentStatus.CONFIRMED] } }, select: { id: true } }),
      ]);
      if (orderPayment || repayment) throw new ConflictException('This M-Pesa reference code is already in use');
      return tx.creditRepayment.create({ data: { customerId, amount: amount.toNumber(), method: PaymentMethod.MPESA, channel: PaymentChannel.MANUAL, status: PaymentStatus.PENDING, referenceCode, recordedById: userId, note }, include: repaymentInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  verify(companyId: string, shopId: string, customerId: string, repaymentId: string, verifierId: string, result: 'CONFIRMED' | 'FAILED', reason?: string) {
    this.logger.log(`Verifying credit repayment ${repaymentId}`);
    return this.prisma.$transaction(async (tx) => {
      const repayment = await tx.creditRepayment.findFirst({ where: { id: repaymentId, customerId, customer: { companyId }, method: PaymentMethod.MPESA, status: PaymentStatus.PENDING } });
      if (!repayment) return null;
      const now = new Date();
      if (result === 'FAILED') return tx.creditRepayment.update({ where: { id: repayment.id }, data: { status: PaymentStatus.FAILED, verifiedById: verifierId, verifiedAt: now, failureReason: reason?.trim() || 'Reference could not be verified' }, include: repaymentInclude });
      const account = await tx.creditAccountCache.findUnique({ where: { customerId } });
      const amount = new Prisma.Decimal(repayment.amount);
      if (!account || amount.greaterThan(account.currentBalance)) throw new ConflictException('Repayment exceeds the current customer balance');
      const updated = await tx.creditRepayment.update({ where: { id: repayment.id }, data: { status: PaymentStatus.CONFIRMED, verifiedById: verifierId, verifiedAt: now, confirmedAt: now, failureReason: null }, include: repaymentInclude });
      await this.applyConfirmed(tx, customerId, repayment.recordedById, amount, reason ?? `M-Pesa repayment ${repayment.referenceCode}`);
      await this.postRepayment(tx, companyId, shopId, verifierId, repayment.id, PaymentMethod.MPESA, amount, now);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async adjust(companyId: string, shopId: string, customerId: string, userId: string, type: 'DISCOUNT' | 'PARDON', amount: Prisma.Decimal, reason: string) {
    this.logger.log(`Applying ${type} to customer ${customerId}`);
    return await this.prisma.$transaction(async (tx) => {
      const customer = await this.loadAccount(tx, companyId, customerId);
      const balance = customer.creditAccount?.currentBalance ?? new Prisma.Decimal(0);
      await this.assertAvailable(tx, customerId, balance, amount);
      const updated = await tx.creditAccountCache.updateMany({ where: { customerId, currentBalance: { gte: amount } }, data: { currentBalance: { decrement: amount } } });
      if (updated.count !== 1) throw new ConflictException('Customer balance changed; reload and try again');
      const transaction = await tx.creditTransaction.create({ data: { customerId, type: type === 'DISCOUNT' ? CreditTransactionType.CREDIT_DISCOUNT : CreditTransactionType.DEBT_FORGIVENESS, amount: amount.negated(), note: reason, recordedById: userId }, include: { recordedBy: { select: { id: true, name: true } } } });
      await this.accountSeeder.initializeInTransaction(tx, companyId, shopId);
      await this.accounting.post(tx, {
        companyId, shopId, recordedById: userId, eventType: AccountingEventType.CREDIT_ADJUSTMENT,
        transactionDate: new Date(), description: `${type === 'DISCOUNT' ? 'Credit discount' : 'Debt pardon'} for ${customer.name}: ${reason}`,
        source: { type: AccountingSourceType.CREDIT_TRANSACTION, id: transaction.id },
        lines: [
          { purpose: type === 'DISCOUNT' ? AccountPurpose.SALES_DISCOUNTS : AccountPurpose.BAD_DEBT_EXPENSE, side: JournalSide.DEBIT, amount },
          { purpose: AccountPurpose.CUSTOMER_RECEIVABLE, side: JournalSide.CREDIT, amount },
        ],
      });
      return transaction;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async loadAccount(tx: Prisma.TransactionClient, companyId: string, customerId: string) {
    const customer = await tx.customer.findFirst({ where: { id: customerId, companyId }, include: { creditAccount: true } });
    if (!customer) throw new ConflictException('Customer credit account was not found');
    return customer;
  }
  private async assertAvailable(tx: Prisma.TransactionClient, customerId: string, balance: Prisma.Decimal, amount: Prisma.Decimal) {
    const pending = await tx.creditRepayment.aggregate({ where: { customerId, status: PaymentStatus.PENDING }, _sum: { amount: true } });
    const reserved = new Prisma.Decimal(pending._sum.amount ?? 0);
    if (amount.add(reserved).greaterThan(balance)) throw new ConflictException('Repayment exceeds the unreserved customer balance');
  }
  private async applyConfirmed(tx: Prisma.TransactionClient, customerId: string, recordedById: string, amount: Prisma.Decimal, note: string) {
    await tx.creditTransaction.create({ data: { customerId, type: CreditTransactionType.REPAYMENT, amount: amount.negated(), note, recordedById } });
    await tx.creditAccountCache.update({ where: { customerId }, data: { currentBalance: { decrement: amount } } });
  }

  private async postRepayment(tx: Prisma.TransactionClient, companyId: string, shopId: string, recordedById: string, repaymentId: string, method: PaymentMethod, amount: Prisma.Decimal, date: Date | null) {
    await this.accountSeeder.initializeInTransaction(tx, companyId, shopId);
    await this.accounting.post(tx, {
      companyId, shopId, recordedById, eventType: AccountingEventType.CUSTOMER_REPAYMENT,
      transactionDate: date ?? new Date(), description: `${method} customer credit repayment`,
      source: { type: AccountingSourceType.CREDIT_REPAYMENT, id: repaymentId },
      lines: [
        { purpose: method === PaymentMethod.CASH ? AccountPurpose.CASH_ON_HAND : AccountPurpose.MPESA, side: JournalSide.DEBIT, amount },
        { purpose: AccountPurpose.CUSTOMER_RECEIVABLE, side: JournalSide.CREDIT, amount },
      ],
    });
  }
}
