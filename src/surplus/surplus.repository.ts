import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountPurpose, AccountingEventType, AccountingSourceType, ItemType, JournalSide, PaymentMethod, Prisma } from 'generated/prisma/client';
import { AccountSeederService } from 'src/accounting/account-seeder.service';
import { AccountingPostingService } from 'src/accounting/accounting-posting.service';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class SurplusRepository {
  private readonly logger = new Logger(SurplusRepository.name);
  constructor(private readonly prisma: PrismaService, private readonly seeder: AccountSeederService, private readonly accounting: AccountingPostingService) {}

  async report(shopId: string, from?: string, to?: string, cashierId?: string) {
    const range = this.range(from, to);
    const lines = await this.prisma.orderLineItem.findMany({
      where: { itemType: ItemType.PRODUCT, surplusTotal: { gt: 0 }, ...(cashierId ? { surplusAppliedById: cashierId } : {}), order: { shopId, createdAt: { gte: range.from, lte: range.to } } },
      include: {
        order: { select: { id: true, createdAt: true } },
        surplusAppliedBy: { select: { id: true, name: true, email: true } },
        refundLineItems: { select: { surplusReversed: true } },
        surplusSettlementLines: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const products = await this.prisma.product.findMany({ where: { id: { in: lines.map((line) => line.itemId) } }, select: { id: true, name: true } });
    const names = new Map(products.map((product) => [product.id, product.name]));
    const cashiers = new Map<string, { user: { id: string; name: string; email: string }; grossEarned: Prisma.Decimal; reversed: Prisma.Decimal; paid: Prisma.Decimal; sales: object[] }>();
    for (const line of lines) {
      if (!line.surplusAppliedBy) continue;
      const reversed = line.refundLineItems.reduce((sum, item) => sum.add(item.surplusReversed), new Prisma.Decimal(0));
      const paid = line.surplusSettlementLines.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      const record = cashiers.get(line.surplusAppliedBy.id) ?? { user: line.surplusAppliedBy, grossEarned: new Prisma.Decimal(0), reversed: new Prisma.Decimal(0), paid: new Prisma.Decimal(0), sales: [] };
      record.grossEarned = record.grossEarned.add(line.surplusTotal);
      record.reversed = record.reversed.add(reversed);
      record.paid = record.paid.add(paid);
      record.sales.push({ orderId: line.order.id, orderLineItemId: line.id, soldAt: line.order.createdAt, productName: names.get(line.itemId) ?? 'Product', quantity: line.quantity, catalogueUnitPrice: line.originalUnitPrice, negotiatedUnitPrice: line.finalUnitPrice, grossSurplus: line.surplusTotal, reversed, paid, outstanding: line.surplusTotal.sub(reversed).sub(paid) });
      cashiers.set(line.surplusAppliedBy.id, record);
    }
    const result = [...cashiers.values()].map((record) => ({ ...record, outstanding: record.grossEarned.sub(record.reversed).sub(record.paid) }));
    return { from: range.from, to: range.to, cashiers: result, totals: result.reduce((totals, item) => ({ grossEarned: totals.grossEarned.add(item.grossEarned), reversed: totals.reversed.add(item.reversed), paid: totals.paid.add(item.paid), outstanding: totals.outstanding.add(item.outstanding) }), { grossEarned: new Prisma.Decimal(0), reversed: new Prisma.Decimal(0), paid: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(0) }) };
  }

  async settle(shopId: string, paidById: string, input: { cashierId: string; from: string; to: string; paymentMethod: PaymentMethod; mpesaReference?: string }) {
    return await this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.findUnique({ where: { id: shopId }, select: { companyId: true } });
      if (!shop) throw new NotFoundException('Shop not found');
      const range = this.range(input.from, input.to);
      const lines = await tx.orderLineItem.findMany({
        where: { itemType: ItemType.PRODUCT, surplusAppliedById: input.cashierId, surplusTotal: { gt: 0 }, order: { shopId, createdAt: { gte: range.from, lte: range.to } } },
        include: { refundLineItems: { select: { surplusReversed: true } }, surplusSettlementLines: { select: { amount: true } } },
      });
      const allocations = lines.map((line) => ({ orderLineItemId: line.id, amount: line.surplusTotal.sub(line.refundLineItems.reduce((sum, item) => sum.add(item.surplusReversed), new Prisma.Decimal(0))).sub(line.surplusSettlementLines.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0))).toDecimalPlaces(2) })).filter((line) => !line.amount.isZero());
      const amount = allocations.reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0)).toDecimalPlaces(2);
      if (!amount.isPositive()) throw new ConflictException('There is no positive surplus payable for this period');
      if (input.paymentMethod === PaymentMethod.MPESA && !input.mpesaReference?.trim()) throw new ConflictException('M-Pesa reference is required');
      const settlement = await tx.cashierSurplusSettlement.create({ data: { shopId, cashierId: input.cashierId, paidById, periodStart: range.from, periodEnd: range.to, amount, paymentMethod: input.paymentMethod, mpesaReference: input.mpesaReference?.trim().toUpperCase(), lines: { create: allocations } } });
      await this.seeder.initializeInTransaction(tx, shop.companyId, shopId);
      await this.accounting.post(tx, { companyId: shop.companyId, shopId, recordedById: paidById, eventType: AccountingEventType.CASHIER_SURPLUS_SETTLEMENT, transactionDate: new Date(), description: `Cashier surplus paid for ${input.from} to ${input.to}`, source: { type: AccountingSourceType.CASHIER_SURPLUS_SETTLEMENT, id: settlement.id }, lines: [
        { purpose: AccountPurpose.CASHIER_SURPLUS_PAYABLE, side: JournalSide.DEBIT, amount },
        { purpose: input.paymentMethod === PaymentMethod.CASH ? AccountPurpose.CASH_ON_HAND : AccountPurpose.MPESA, side: JournalSide.CREDIT, amount },
      ] });
      this.logger.log(`Settled ${amount} surplus for cashier ${input.cashierId}`);
      return await tx.cashierSurplusSettlement.findUniqueOrThrow({ where: { id: settlement.id }, include: { cashier: { select: { id: true, name: true, email: true } }, paidBy: { select: { id: true, name: true } }, lines: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private range(from?: string, to?: string) {
    const now = new Date();
    const monday = new Date(now); monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7)); monday.setUTCHours(0, 0, 0, 0);
    const start = from ? new Date(`${from}T00:00:00.000Z`) : monday;
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    if (start > end) throw new ConflictException('from must be before or equal to to');
    return { from: start, to: end };
  }
}
