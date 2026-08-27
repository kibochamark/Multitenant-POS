import { AccountPurpose, ItemType, JournalSide, Prisma } from 'generated/prisma/client';
import { JournalPostingLine } from './accounting.types';

type SaleTotals = {
  total: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  lineItems: Array<{ itemType: ItemType; lineTotal: Prisma.Decimal }>;
};

// Splits net revenue between products and services while assigning any
// rounding remainder to services. The original order snapshot remains truth.
export function saleRecognitionLines(sale: SaleTotals, reverse = false): JournalPostingLine[] {
  const productGross = sale.lineItems
    .filter((line) => line.itemType === ItemType.PRODUCT)
    .reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
  const productNet = sale.total.isZero()
    ? new Prisma.Decimal(0)
    : sale.subtotal.mul(productGross).div(sale.total).toDecimalPlaces(2);
  const serviceNet = sale.subtotal.sub(productNet);
  const revenueSide = reverse ? JournalSide.DEBIT : JournalSide.CREDIT;
  const settlementSide = reverse ? JournalSide.CREDIT : JournalSide.DEBIT;
  const lines: JournalPostingLine[] = [
    { purpose: AccountPurpose.CUSTOMER_RECEIVABLE, side: settlementSide, amount: sale.total },
  ];
  if (productNet.isPositive()) lines.push({ purpose: AccountPurpose.PRODUCT_REVENUE, side: revenueSide, amount: productNet });
  if (serviceNet.isPositive()) lines.push({ purpose: AccountPurpose.SERVICE_REVENUE, side: revenueSide, amount: serviceNet });
  if (sale.vatAmount.isPositive()) lines.push({ purpose: AccountPurpose.VAT_PAYABLE, side: revenueSide, amount: sale.vatAmount });
  return lines;
}
