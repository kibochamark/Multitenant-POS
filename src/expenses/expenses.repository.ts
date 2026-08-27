import { Injectable, Logger } from '@nestjs/common';
import { AccountPurpose, AccountingEventType, AccountingSourceType, JournalSide, PaymentMethod, Prisma } from 'generated/prisma/client';
import { AccountSeederService } from 'src/accounting/account-seeder.service';
import { AccountingPostingService } from 'src/accounting/accounting-posting.service';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

const expenseInclude = {
  recordedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpensesRepository {
  private readonly logger = new Logger(ExpensesRepository.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountSeeder: AccountSeederService,
    private readonly accounting: AccountingPostingService,
  ) {}

  async create(
    companyId: string,
    shopId: string,
    recordedById: string,
    data: { amount: Prisma.Decimal; category: string; description: string; paymentMethod: 'CASH' | 'MPESA'; mpesaReference?: string | null },
  ) {
    this.logger.log(`Recording expense for shop ${shopId}`);
    return await this.prisma.$transaction(async (tx) => {
      await this.accountSeeder.initializeInTransaction(tx, companyId, shopId);
      const expense = await tx.expense.create({
        data: { shopId, recordedById, ...data, paymentMethod: data.paymentMethod as PaymentMethod },
        include: expenseInclude,
      });
      const paidFrom = data.paymentMethod === PaymentMethod.CASH ? AccountPurpose.CASH_ON_HAND : AccountPurpose.MPESA;
      await this.accounting.post(tx, {
        companyId,
        shopId,
        recordedById,
        eventType: AccountingEventType.EXPENSE,
        transactionDate: expense.createdAt,
        description: `${expense.category}: ${expense.description}`,
        source: { type: AccountingSourceType.EXPENSE, id: expense.id },
        lines: [
          { purpose: AccountPurpose.GENERAL_EXPENSE, side: JournalSide.DEBIT, amount: expense.amount },
          { purpose: paidFrom, side: JournalSide.CREDIT, amount: expense.amount, description: expense.mpesaReference ?? undefined },
        ],
      });
      return expense;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async list(
    shopId: string,
    options: { limit: number; cursor?: string; category?: string },
  ) {
    this.logger.log(`Listing expenses for shop ${shopId}`);
    return await this.prisma.expense.findMany({
      where: {
        shopId,
        ...(options.category ? { category: options.category } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: expenseInclude,
    });
  }
}
