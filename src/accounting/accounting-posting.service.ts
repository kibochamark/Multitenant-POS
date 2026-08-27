import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JournalEntryStatus, JournalSide, Prisma } from 'generated/prisma/client';
import { randomUUID } from 'node:crypto';
import { PostJournalCommand } from './accounting.types';

@Injectable()
export class AccountingPostingService {
  private readonly logger = new Logger(AccountingPostingService.name);

  async post(tx: Prisma.TransactionClient, command: PostJournalCommand) {
    if (command.lines.length < 2) throw new ConflictException('A journal entry requires at least two lines');
    const normalized = command.lines.map((line) => ({ ...line, amount: line.amount.toDecimalPlaces(2) }));
    if (normalized.some((line) => !line.amount.isPositive())) throw new ConflictException('Journal amounts must be greater than zero');
    const debit = normalized.filter((line) => line.side === JournalSide.DEBIT).reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0));
    const credit = normalized.filter((line) => line.side === JournalSide.CREDIT).reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0));
    if (!debit.equals(credit)) throw new ConflictException(`Journal is not balanced: debits ${debit} do not equal credits ${credit}`);

    const duplicate = await tx.accountingEventLink.findUnique({
      where: { sourceType_sourceId: { sourceType: command.source.type, sourceId: command.source.id } },
      include: { entry: { include: { lines: true } } },
    });
    if (duplicate) return duplicate.entry;

    const accounts = await this.resolveAccounts(tx, command, normalized);
    const period = await this.period(tx, command.companyId, command.transactionDate);
    const entry = await tx.journalEntry.create({
      data: {
        companyId: command.companyId, shopId: command.shopId, periodId: period.id,
        entryNumber: `JE-${randomUUID()}`, eventType: command.eventType,
        transactionDate: command.transactionDate, description: command.description,
        status: JournalEntryStatus.DRAFT, recordedById: command.recordedById,
      },
    });

    const grouped = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
    for (let index = 0; index < normalized.length; index += 1) {
      const line = normalized[index];
      const account = accounts[index];
      await tx.journalLine.create({ data: { entryId: entry.id, accountId: account.id, side: line.side, amount: line.amount, description: line.description } });
      const totals = grouped.get(account.id) ?? { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) };
      if (line.side === JournalSide.DEBIT) totals.debit = totals.debit.add(line.amount);
      else totals.credit = totals.credit.add(line.amount);
      grouped.set(account.id, totals);
    }

    const businessDate = new Date(Date.UTC(command.transactionDate.getUTCFullYear(), command.transactionDate.getUTCMonth(), command.transactionDate.getUTCDate()));
    for (const [accountId, movement] of grouped) await this.updateCaches(tx, accountId, entry.id, businessDate, movement);
    await tx.accountingEventLink.create({ data: { entryId: entry.id, sourceType: command.source.type, sourceId: command.source.id } });
    this.logger.log(`Posted balanced journal entry ${entry.id}`);
    return tx.journalEntry.update({
      where: { id: entry.id }, data: { status: JournalEntryStatus.POSTED, postedAt: new Date() },
      include: { lines: { include: { account: true } }, sourceLinks: true },
    });
  }

  private async resolveAccounts(tx: Prisma.TransactionClient, command: PostJournalCommand, lines: PostJournalCommand['lines']) {
    const accounts = [];
    for (const line of lines) {
      const account = line.accountId
        ? await tx.account.findFirst({ where: { id: line.accountId, companyId: command.companyId, isActive: true } })
        : line.purpose
          ? await tx.account.findFirst({ where: { shopId: command.shopId, purpose: line.purpose, isActive: true } })
          : null;
      if (!account) throw new NotFoundException(`Accounting account was not found for ${line.accountId ?? line.purpose ?? 'line'}`);
      if (account.shopId && account.shopId !== command.shopId) throw new ConflictException('Journal account belongs to another shop');
      accounts.push(account);
    }
    return accounts;
  }

  private async period(tx: Prisma.TransactionClient, companyId: string, date: Date) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    const period = await tx.accountingPeriod.upsert({
      where: { companyId_startsAt_endsAt: { companyId, startsAt: start, endsAt: end } },
      create: { companyId, name: start.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }), startsAt: start, endsAt: end },
      update: {},
    });
    if (period.status !== 'OPEN') throw new ConflictException('The accounting period is closed');
    return period;
  }

  private async updateCaches(tx: Prisma.TransactionClient, accountId: string, entryId: string, businessDate: Date, movement: { debit: Prisma.Decimal; credit: Prisma.Decimal }) {
    const delta = movement.debit.sub(movement.credit);
    const current = await tx.accountBalanceCache.upsert({
      where: { accountId }, create: { accountId }, update: {},
    });
    await tx.accountBalanceCache.update({
      where: { accountId },
      data: { totalDebit: { increment: movement.debit }, totalCredit: { increment: movement.credit }, balance: { increment: delta }, lastEntryId: entryId },
    });
    await tx.accountDailyBalance.upsert({
      where: { accountId_businessDate: { accountId, businessDate } },
      create: { accountId, businessDate, openingBalance: current.balance, debitMovement: movement.debit, creditMovement: movement.credit, closingBalance: current.balance.add(delta) },
      update: { debitMovement: { increment: movement.debit }, creditMovement: { increment: movement.credit }, closingBalance: { increment: delta } },
    });
  }
}
