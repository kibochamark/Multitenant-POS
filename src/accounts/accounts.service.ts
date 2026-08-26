import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod, Prisma } from 'generated/prisma/client';
import { AccountsRepository } from './accounts.repository';
import { AccountsRangeQueryDto, SetOpeningCashDto } from './dto/accounts.dto';

const zone = 'Africa/Nairobi';

@Injectable()
export class AccountsService {
  constructor(private readonly repository: AccountsRepository) {}

  async list(shopId: string, query: AccountsRangeQueryDto) {
    const today = this.dateKey(new Date());
    const from = query.from ?? today;
    const to = query.to ?? today;
    const start = this.start(from);
    const finalDay = this.start(to);
    if (start > finalDay) throw new BadRequestException('from must be before or equal to to');
    const days = Math.floor((finalDay.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days > 366) throw new BadRequestException('Date range cannot exceed 366 days');
    const end = new Date(finalDay.getTime() + 86_400_000);
    const data = await this.repository.dailyRecords(shopId, start, end, this.databaseDate(from), new Date(this.databaseDate(to).getTime() + 86_400_000));
    const records = Array.from({ length: days }, (_, index) => this.empty(this.dateKey(new Date(start.getTime() + index * 86_400_000))));
    const byDate = new Map(records.map((record) => [record.date, record]));

    for (const order of data.orders) this.add(byDate, order.createdAt, 'grossRevenue', order.total);
    for (const payment of data.payments) this.add(byDate, payment.confirmedAt!, payment.method === PaymentMethod.CASH ? 'cashCollected' : 'mpesaCollected', payment.amount);
    const creditOrders = new Map<string, Set<string>>();
    for (const credit of data.credits) {
      const date = this.dateKey(credit.createdAt);
      this.add(byDate, credit.createdAt, 'creditAmount', credit.amount);
      if (credit.orderId) (creditOrders.get(date) ?? creditOrders.set(date, new Set()).get(date)!).add(credit.orderId);
    }
    for (const expense of data.expenses) {
      this.add(byDate, expense.createdAt, 'expenses', expense.amount);
      this.add(byDate, expense.createdAt, expense.paymentMethod === PaymentMethod.CASH ? 'cashExpenses' : 'mpesaExpenses', expense.amount);
    }
    for (const opening of data.openings) {
      const record = byDate.get(this.dateKey(opening.businessDate));
      if (record) { record.openingCash = opening.openingCash; record.openingRecordedBy = opening.recordedBy; record.openingUpdatedAt = opening.updatedAt; }
    }

    return {
      from, to,
      formula: 'Net revenue = sales and services revenue − expenses',
      cashFormula: 'Expected cash at hand = starting cash + confirmed cash sales − cash expenses',
      mpesaFormula: 'Net M-Pesa = confirmed M-Pesa sales − M-Pesa expenses',
      records: records.reverse().map((record) => ({
        ...record,
        creditSalesCount: creditOrders.get(record.date)?.size ?? 0,
        netRevenue: record.grossRevenue.sub(record.expenses).toString(),
        expectedClosingCash: record.openingCash.add(record.cashCollected).sub(record.cashExpenses).toString(),
        netMpesa: record.mpesaCollected.sub(record.mpesaExpenses).toString(),
        openingCash: record.openingCash.toString(), cashCollected: record.cashCollected.toString(), mpesaCollected: record.mpesaCollected.toString(), cashExpenses: record.cashExpenses.toString(), mpesaExpenses: record.mpesaExpenses.toString(), creditAmount: record.creditAmount.toString(), expenses: record.expenses.toString(), grossRevenue: record.grossRevenue.toString(),
      })),
    };
  }

  setOpeningCash(shopId: string, userId: string, data: SetOpeningCashDto) {
    const date = this.databaseDate(data.businessDate);
    if (date > this.databaseDate(this.dateKey(new Date()))) throw new BadRequestException('Starting cash cannot be set for a future day');
    return this.repository.setOpeningCash(shopId, userId, date, new Prisma.Decimal(data.openingCash));
  }

  private empty(date: string) { return { date, openingCash: new Prisma.Decimal(0), cashCollected: new Prisma.Decimal(0), mpesaCollected: new Prisma.Decimal(0), cashExpenses: new Prisma.Decimal(0), mpesaExpenses: new Prisma.Decimal(0), creditAmount: new Prisma.Decimal(0), expenses: new Prisma.Decimal(0), grossRevenue: new Prisma.Decimal(0), openingRecordedBy: null as { id: string; name: string } | null, openingUpdatedAt: null as Date | null }; }
  private add(records: Map<string, ReturnType<AccountsService['empty']>>, date: Date, field: 'cashCollected' | 'mpesaCollected' | 'cashExpenses' | 'mpesaExpenses' | 'creditAmount' | 'expenses' | 'grossRevenue', amount: Prisma.Decimal) { const record = records.get(this.dateKey(date)); if (record) record[field] = record[field].add(amount); }
  private start(date: string) { const parsed = new Date(`${date}T00:00:00+03:00`); if (Number.isNaN(parsed.getTime()) || this.dateKey(parsed) !== date) throw new BadRequestException('Invalid calendar date'); return parsed; }
  private databaseDate(date: string) { this.start(date); return new Date(`${date}T00:00:00.000Z`); }
  private dateKey(date: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
}
