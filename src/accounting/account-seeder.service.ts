import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountPurpose, AccountScope, AccountType, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

const SHOP_ACCOUNTS: Array<{ code: string; name: string; type: AccountType; purpose: AccountPurpose }> = [
  { code: '1110', name: 'Cash at hand', type: AccountType.ASSET, purpose: AccountPurpose.CASH_ON_HAND },
  { code: '1120', name: 'M-Pesa balance', type: AccountType.ASSET, purpose: AccountPurpose.MPESA },
  { code: '1130', name: 'Bank balance', type: AccountType.ASSET, purpose: AccountPurpose.BANK },
  { code: '1200', name: 'Customer receivables', type: AccountType.ASSET, purpose: AccountPurpose.CUSTOMER_RECEIVABLE },
  { code: '1300', name: 'Inventory', type: AccountType.ASSET, purpose: AccountPurpose.INVENTORY },
  { code: '1390', name: 'Unallocated inventory cost', type: AccountType.ASSET, purpose: AccountPurpose.UNALLOCATED_INVENTORY_COST },
  { code: '2100', name: 'VAT payable', type: AccountType.LIABILITY, purpose: AccountPurpose.VAT_PAYABLE },
  { code: '3100', name: 'Owner capital', type: AccountType.EQUITY, purpose: AccountPurpose.OWNER_CAPITAL },
  { code: '3200', name: 'Owner drawings', type: AccountType.EQUITY, purpose: AccountPurpose.OWNER_DRAWINGS },
  { code: '4100', name: 'Product revenue', type: AccountType.REVENUE, purpose: AccountPurpose.PRODUCT_REVENUE },
  { code: '4200', name: 'Service revenue', type: AccountType.REVENUE, purpose: AccountPurpose.SERVICE_REVENUE },
  { code: '4900', name: 'Sales returns', type: AccountType.REVENUE, purpose: AccountPurpose.SALES_RETURNS },
  { code: '5100', name: 'Cost of goods sold', type: AccountType.EXPENSE, purpose: AccountPurpose.COST_OF_GOODS_SOLD },
  { code: '5800', name: 'General expense', type: AccountType.EXPENSE, purpose: AccountPurpose.GENERAL_EXPENSE },
  { code: '5900', name: 'Cash over and short', type: AccountType.EXPENSE, purpose: AccountPurpose.CASH_OVER_SHORT },
];

@Injectable()
export class AccountSeederService {
  private readonly logger = new Logger(AccountSeederService.name);
  constructor(private readonly prisma: PrismaService) {}

  async initialize(companyId: string, shopId: string) {
    return await this.prisma.$transaction((tx) => this.initializeInTransaction(tx, companyId, shopId));
  }

  async initializeInTransaction(tx: Prisma.TransactionClient, companyId: string, shopId: string) {
    const shop = await tx.shop.findFirst({ where: { id: shopId, companyId }, select: { id: true, name: true } });
    if (!shop) throw new NotFoundException('Shop does not belong to this company');
    const suffix = shopId.replace(/-/g, '').slice(0, 8).toUpperCase();
    const accounts = [];
    for (const definition of SHOP_ACCOUNTS) {
      const account = await tx.account.upsert({
        where: { shopId_purpose: { shopId, purpose: definition.purpose } },
        create: {
          companyId, shopId, scope: AccountScope.SHOP, type: definition.type,
          purpose: definition.purpose, code: `${definition.code}-${suffix}`,
          name: `${shop.name} · ${definition.name}`, isSystem: true,
          balanceCache: { create: {} },
        },
        update: { isActive: true },
        include: { balanceCache: true },
      });
      if (!account.balanceCache)
        await tx.accountBalanceCache.create({ data: { accountId: account.id } });
      accounts.push(account);
    }
    this.logger.log(`Initialized ${accounts.length} accounting accounts for shop ${shopId}`);
    return accounts;
  }
}
