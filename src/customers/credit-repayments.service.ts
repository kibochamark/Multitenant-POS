import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { CashCreditRepaymentDto, MpesaCreditRepaymentDto, VerifyCreditRepaymentDto } from './dto/credit-repayment.dto';
import { CreditRepaymentsRepository } from './credit-repayments.repository';

@Injectable()
export class CreditRepaymentsService {
  private readonly logger = new Logger(CreditRepaymentsService.name);
  constructor(private readonly repository: CreditRepaymentsRepository) {}
  async account(companyId: string, customerId: string) { const account = await this.repository.account(companyId, customerId); if (!account) throw new NotFoundException('Customer not found'); const balance = account.creditAccount?.currentBalance ?? new Prisma.Decimal(0); const pendingTotal = account.creditRepayments.filter((item) => item.status === 'PENDING').reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)); return { ...account, currentBalance: balance, pendingTotal, availableToRepay: Prisma.Decimal.max(balance.sub(pendingTotal), new Prisma.Decimal(0)) }; }
  cash(companyId: string, customerId: string, userId: string, data: CashCreditRepaymentDto) { return this.repository.recordCash(companyId, customerId, userId, new Prisma.Decimal(data.amount), data.note?.trim() || undefined); }
  mpesa(companyId: string, customerId: string, userId: string, data: MpesaCreditRepaymentDto) { return this.repository.recordMpesa(companyId, customerId, userId, new Prisma.Decimal(data.amount), data.referenceCode.trim().toUpperCase(), data.note?.trim() || undefined); }
  async verify(companyId: string, customerId: string, repaymentId: string, verifierId: string, data: VerifyCreditRepaymentDto) { const result = await this.repository.verify(companyId, customerId, repaymentId, verifierId, data.result, data.reason); if (!result) throw new NotFoundException('Pending M-Pesa repayment not found'); return result; }
}
