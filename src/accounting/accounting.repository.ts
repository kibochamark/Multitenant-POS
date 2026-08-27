import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class AccountingRepository {
  private readonly logger = new Logger(AccountingRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(companyId: string, shopId: string) {
    this.logger.log(`Listing accounting accounts for shop ${shopId}`);
    return await this.prisma.account.findMany({
      where: { companyId, OR: [{ shopId }, { shopId: null }] },
      orderBy: [{ code: 'asc' }], include: { balanceCache: true },
    });
  }

  async listJournal(companyId: string, shopId: string, limit = 50) {
    this.logger.log(`Listing journal entries for shop ${shopId}`);
    return await this.prisma.journalEntry.findMany({
      where: { companyId, shopId }, orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(limit, 1), 100),
      include: { recordedBy: { select: { id: true, name: true } }, lines: { include: { account: { select: { id: true, code: true, name: true, purpose: true } } } }, sourceLinks: true },
    });
  }

  async dailyBalances(companyId: string, shopId: string, from: Date, to: Date) {
    this.logger.log(`Listing daily accounting balances for shop ${shopId}`);
    return await this.prisma.accountDailyBalance.findMany({
      where: { account: { companyId, shopId }, businessDate: { gte: from, lte: to } },
      orderBy: [{ businessDate: 'desc' }, { account: { code: 'asc' } }],
      include: { account: { select: { id: true, code: true, name: true, type: true, purpose: true } } },
    });
  }
}
