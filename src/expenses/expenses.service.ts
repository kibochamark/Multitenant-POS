import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { CreateExpenseDto, ExpenseListQueryDto } from './dto/expense.dto';
import { ExpensesRepository } from './expenses.repository';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);
  constructor(private readonly repository: ExpensesRepository) {}

  create(shopId: string, userId: string, data: CreateExpenseDto) {
    this.logger.log(`Preparing expense creation for shop ${shopId}`);
    return this.repository.create(shopId, userId, {
      amount: new Prisma.Decimal(data.amount),
      category: data.category.trim(),
      description: data.description.trim(),
      paymentMethod: data.paymentMethod,
      ...(data.paymentMethod === 'MPESA' && data.mpesaReference?.trim()
        ? { mpesaReference: data.mpesaReference.trim().toUpperCase() }
        : { mpesaReference: null }),
    });
  }

  async list(shopId: string, query: ExpenseListQueryDto) {
    this.logger.log(`Preparing expense list for shop ${shopId}`);
    const limit = Number(query.limit ?? 25);
    const rows = await this.repository.list(shopId, {
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.category?.trim() ? { category: query.category.trim() } : {}),
    });
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
      },
    };
  }
}
