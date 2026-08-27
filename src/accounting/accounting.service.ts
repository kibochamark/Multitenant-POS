import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AccountingEventType, AccountingSourceType, AccountPurpose, JournalSide, PaymentMethod, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { AccountSeederService } from './account-seeder.service';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountingRepository } from './accounting.repository';
import { CreateManualJournalDto, RecordUnallocatedInventoryPurchaseDto } from './dto/accounting.dto';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);
  constructor(private readonly prisma: PrismaService, private readonly seeder: AccountSeederService, private readonly posting: AccountingPostingService, private readonly repository: AccountingRepository) {}

  async initialize(companyId: string, shopId: string) { return await this.seeder.initialize(companyId, shopId); }
  async accounts(companyId: string, shopId: string) { return await this.repository.listAccounts(companyId, shopId); }
  async journal(companyId: string, shopId: string, limit?: string) {
    const parsedLimit = Number(limit ?? 50);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) throw new BadRequestException('limit must be a positive integer');
    return await this.repository.listJournal(companyId, shopId, parsedLimit);
  }
  async dailyBalances(companyId: string, shopId: string, from?: string, to?: string) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !datePattern.test(from)) throw new BadRequestException('from must use YYYY-MM-DD');
    if (to && !datePattern.test(to)) throw new BadRequestException('to must use YYYY-MM-DD');
    const end = to ? new Date(`${to}T00:00:00.000Z`) : new Date();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.now() - 30 * 86_400_000);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start > end) throw new BadRequestException('Invalid date range');
    return await this.repository.dailyBalances(companyId, shopId, start, end);
  }

  async manual(companyId: string, shopId: string, userId: string, data: CreateManualJournalDto) {
    this.logger.log(`Posting manual journal in shop ${shopId}`);
    return await this.prisma.$transaction(async (tx) => {
      await this.seeder.initializeInTransaction(tx, companyId, shopId);
      return this.posting.post(tx, {
        companyId, shopId, recordedById: userId, eventType: data.eventType,
        transactionDate: new Date(), description: data.description.trim(),
        source: { type: AccountingSourceType.MANUAL_JOURNAL, id: data.idempotencyKey.trim() },
        lines: data.lines.map((line) => ({ purpose: line.purpose, side: line.side, amount: new Prisma.Decimal(line.amount), description: line.description?.trim() })),
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async unallocatedPurchase(companyId: string, shopId: string, userId: string, data: RecordUnallocatedInventoryPurchaseDto) {
    this.logger.log(`Recording private unallocated inventory purchase in shop ${shopId}`);
    return await this.prisma.$transaction(async (tx) => {
      await this.seeder.initializeInTransaction(tx, companyId, shopId);
      const paymentPurpose = data.paymentMethod === PaymentMethod.CASH ? AccountPurpose.CASH_ON_HAND : AccountPurpose.MPESA;
      return this.posting.post(tx, {
        companyId, shopId, recordedById: userId, eventType: AccountingEventType.INVENTORY_PURCHASE,
        transactionDate: new Date(), description: data.description.trim(),
        source: { type: AccountingSourceType.INVENTORY_PURCHASE, id: data.idempotencyKey.trim() },
        lines: [
          { purpose: AccountPurpose.UNALLOCATED_INVENTORY_COST, side: JournalSide.DEBIT, amount: new Prisma.Decimal(data.amount), description: 'Private inventory purchase awaiting product-cost allocation' },
          { purpose: paymentPurpose, side: JournalSide.CREDIT, amount: new Prisma.Decimal(data.amount), description: data.reference?.trim() },
        ],
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
