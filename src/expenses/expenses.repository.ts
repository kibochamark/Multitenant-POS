import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

const expenseInclude = {
  recordedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpensesRepository {
  private readonly logger = new Logger(ExpensesRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  create(
    shopId: string,
    recordedById: string,
    data: { amount: Prisma.Decimal; category: string; description: string; paymentMethod: 'CASH' | 'MPESA'; mpesaReference?: string | null },
  ) {
    this.logger.log(`Recording expense for shop ${shopId}`);
    return this.prisma.expense.create({
      data: { shopId, recordedById, ...data, paymentMethod: data.paymentMethod as PaymentMethod },
      include: expenseInclude,
    });
  }

  list(
    shopId: string,
    options: { limit: number; cursor?: string; category?: string },
  ) {
    this.logger.log(`Listing expenses for shop ${shopId}`);
    return this.prisma.expense.findMany({
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
