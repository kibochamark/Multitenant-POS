import { AccountingEventType, AccountingSourceType, AccountPurpose, JournalSide, Prisma } from 'generated/prisma/client';

export interface JournalPostingLine {
  accountId?: string;
  purpose?: AccountPurpose;
  side: JournalSide;
  amount: Prisma.Decimal;
  description?: string;
}

export interface PostJournalCommand {
  companyId: string;
  shopId: string;
  recordedById: string;
  eventType: AccountingEventType;
  transactionDate: Date;
  description: string;
  source: { type: AccountingSourceType; id: string };
  lines: JournalPostingLine[];
}
