import { Injectable, Logger } from '@nestjs/common';
import { ItemType, OrderStatus, PaymentStatus, Prisma, ShopRole } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class AdministrationRepository {
  private readonly logger = new Logger(AdministrationRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  async isCompanyManager(userId: string, companyId: string) {
    return Boolean(await this.prisma.userShopRole.findFirst({
      where: { userId, role: { in: [ShopRole.OWNER, ShopRole.MANAGER] }, shop: { companyId } },
      select: { id: true },
    }));
  }

  createShop(companyId: string, data: { name: string; vatPct?: number; defaultMinMarginPct?: number; globalDiscountPct?: number }) {
    this.logger.log(`Creating a managed shop in company ${companyId}`);
    return this.prisma.shop.create({ data: { companyId, name: data.name.trim(), vatPct: data.vatPct ?? null, defaultMinMarginPct: data.defaultMinMarginPct ?? null, globalDiscountPct: data.globalDiscountPct ?? null } });
  }

  listUsers(companyId: string) {
    this.logger.log(`Listing managed users in company ${companyId}`);
    return this.prisma.user.findMany({ where: { companyId }, orderBy: [{ defaultOwner: 'desc' }, { name: 'asc' }], select: { id: true, name: true, email: true, phone: true, defaultOwner: true, isActive: true, shopRoles: { select: { shopId: true, role: true, shop: { select: { name: true } } }, orderBy: { createdAt: 'asc' } } } });
  }

  setUserStatus(companyId: string, userId: string, isActive: boolean) {
    return this.prisma.user.update({ where: { id: userId, companyId, defaultOwner: false }, data: { isActive }, select: { id: true, isActive: true } });
  }

  setMembership(companyId: string, userId: string, shopId: string, role: ShopRole) {
    this.logger.log(`Setting ${role} membership for user ${userId} in shop ${shopId}`);
    return this.prisma.$transaction(async (tx) => {
      const [user, shop] = await Promise.all([
        tx.user.findFirst({ where: { id: userId, companyId, defaultOwner: false }, select: { id: true } }),
        tx.shop.findFirst({ where: { id: shopId, companyId }, select: { id: true } }),
      ]);
      if (!user || !shop) return null;
      return tx.userShopRole.upsert({ where: { userId_shopId: { userId, shopId } }, create: { userId, shopId, role }, update: { role } });
    });
  }

  removeMembership(companyId: string, userId: string, shopId: string) {
    return this.prisma.userShopRole.deleteMany({ where: { userId, shopId, user: { companyId, defaultOwner: false }, shop: { companyId } } });
  }

  async dashboard(shopId: string) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const orderWhere = { shopId, status: { not: OrderStatus.CANCELLED }, createdAt: { gte: start } };
    const [users, products, servicesCatalog, sales, servicesSold, expenses, recentOrders, lowStockProducts] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { isActive: true, company: { shops: { some: { id: shopId } } }, OR: [{ defaultOwner: true }, { shopRoles: { some: { shopId } } }] } }),
      this.prisma.product.count({ where: { shopId, isActive: true } }),
      this.prisma.service.count({ where: { shopId, isActive: true } }),
      this.prisma.order.aggregate({ where: orderWhere, _count: { id: true }, _sum: { total: true } }),
      this.prisma.orderLineItem.aggregate({ where: { itemType: ItemType.SERVICE, order: orderWhere }, _sum: { quantity: true, lineTotal: true } }),
      this.prisma.expense.aggregate({ where: { shopId, createdAt: { gte: start } }, _count: { id: true }, _sum: { amount: true } }),
      this.prisma.order.findMany({ where: orderWhere, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, total: true, createdAt: true, customer: { select: { name: true } }, payments: { where: { status: PaymentStatus.CONFIRMED }, select: { method: true } } } }),
      this.prisma.product.findMany({ where: { shopId, isActive: true }, select: { id: true, name: true, lowStockThreshold: true, stockCache: { select: { currentQuantity: true } } } }),
    ]);
    const lowStock = lowStockProducts.filter((item) => (item.stockCache?.currentQuantity ?? 0) <= item.lowStockThreshold).map((item) => ({ id: item.id, name: item.name, quantity: item.stockCache?.currentQuantity ?? 0, threshold: item.lowStockThreshold }));
    return { metrics: { users, products, servicesCatalog, salesCount: sales._count.id, salesAmount: sales._sum.total?.toString() ?? '0', servicesSold: servicesSold._sum.quantity ?? 0, servicesAmount: servicesSold._sum.lineTotal?.toString() ?? '0', expenseCount: expenses._count.id, expenseAmount: expenses._sum.amount?.toString() ?? '0', lowStockCount: lowStock.length }, lowStock, recentOrders: recentOrders.map((order) => ({ ...order, total: order.total.toString() })) };
  }

  async companyDashboard(companyId: string) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [shops, customers, debt] = await this.prisma.$transaction([
      this.prisma.shop.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true,
          _count: { select: { products: { where: { isActive: true } }, services: { where: { isActive: true } }, userRoles: true } },
          orders: { where: { status: { not: OrderStatus.CANCELLED }, createdAt: { gte: start } }, select: { total: true } },
          expenses: { where: { createdAt: { gte: start } }, select: { amount: true } },
        },
      }),
      this.prisma.customer.count({ where: { companyId } }),
      this.prisma.creditAccountCache.aggregate({ where: { customer: { companyId }, currentBalance: { gt: 0 } }, _count: { id: true }, _sum: { currentBalance: true } }),
    ]);
    const summaries = shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      users: shop._count.userRoles,
      products: shop._count.products,
      services: shop._count.services,
      salesCount: shop.orders.length,
      salesAmount: shop.orders.reduce((sum, order) => sum.add(order.total), new Prisma.Decimal(0)).toString(),
      expenseCount: shop.expenses.length,
      expenseAmount: shop.expenses.reduce((sum, expense) => sum.add(expense.amount), new Prisma.Decimal(0)).toString(),
    }));
    return {
      metrics: {
        shops: summaries.length,
        users: await this.prisma.user.count({ where: { companyId, isActive: true } }),
        customers,
        customersOwing: debt._count.id,
        amountOwed: debt._sum.currentBalance?.toString() ?? '0',
        salesAmount: summaries.reduce((sum, shop) => sum.add(shop.salesAmount), new Prisma.Decimal(0)).toString(),
        expenseAmount: summaries.reduce((sum, shop) => sum.add(shop.expenseAmount), new Prisma.Decimal(0)).toString(),
      },
      shops: summaries,
    };
  }
}
