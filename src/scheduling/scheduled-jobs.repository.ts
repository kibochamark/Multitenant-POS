import { Injectable, Logger } from '@nestjs/common';
import { CartStatus, ItemType, OrderStatus, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class ScheduledJobsRepository {
  private readonly logger = new Logger(ScheduledJobsRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  async abandonStaleCarts(olderThan: Date) {
    this.logger.log(`Closing carts inactive before ${olderThan.toISOString()}`);
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.cart.findMany({ where: { status: CartStatus.ACTIVE, updatedAt: { lt: olderThan } }, select: { id: true } });
      if (!candidates.length) return 0;
      const ids = candidates.map(({ id }) => id);
      // Rechecking the timestamp protects a cart that received a scan between
      // the candidate query and this update.
      await tx.cart.updateMany({ where: { id: { in: ids }, status: CartStatus.ACTIVE, updatedAt: { lt: olderThan } }, data: { status: CartStatus.ABANDONED, activeKey: null } });
      const abandoned = await tx.cart.findMany({ where: { id: { in: ids }, status: CartStatus.ABANDONED }, select: { id: true } });
      await tx.cartItem.deleteMany({ where: { cartId: { in: abandoned.map(({ id }) => id) } } });
      return abandoned.length;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  companies() {
    return this.prisma.company.findMany({
      select: {
        id: true,
        name: true,
        shops: { select: { id: true, name: true } },
        users: { where: { defaultOwner: true, isActive: true }, take: 1, select: { id: true } },
      },
    });
  }

  async dailyShopSummary(shopId: string, start: Date, end: Date) {
    const orderWhere = { shopId, status: { not: OrderStatus.CANCELLED }, createdAt: { gte: start, lt: end } };
    const [sales, services, expenses, products] = await this.prisma.$transaction([
      this.prisma.order.aggregate({ where: orderWhere, _count: { id: true }, _sum: { total: true } }),
      this.prisma.orderLineItem.aggregate({ where: { itemType: ItemType.SERVICE, order: orderWhere }, _sum: { quantity: true, lineTotal: true } }),
      this.prisma.expense.aggregate({ where: { shopId, createdAt: { gte: start, lt: end } }, _count: { id: true }, _sum: { amount: true } }),
      this.prisma.product.findMany({ where: { shopId, isActive: true }, select: { id: true, name: true, lowStockThreshold: true, stockCache: { select: { currentQuantity: true } } } }),
    ]);
    return {
      sales: { count: sales._count.id, amount: sales._sum.total?.toString() ?? '0' },
      services: { count: services._sum.quantity ?? 0, amount: services._sum.lineTotal?.toString() ?? '0' },
      expenses: { count: expenses._count.id, amount: expenses._sum.amount?.toString() ?? '0' },
      lowStock: products.filter((product) => (product.stockCache?.currentQuantity ?? 0) <= product.lowStockThreshold).map((product) => ({ productId: product.id, name: product.name, quantity: product.stockCache?.currentQuantity ?? 0, threshold: product.lowStockThreshold })),
    };
  }


  async LowStockProducts (shopId:string){
    const products = await this.prisma.product.findMany({
      where:{
        shopId:shopId
      },
      select:{
        shopId:true,
        name:true,
        id:true,
        price:true,
        category:true,
        lowStockThreshold:true,
        stockCache:{
          select:{
            currentQuantity:true
          }
        }
      }
    })
    if(!products) throw new Error("prodcuts not available")
    
    const lowstock = products.map((p)=>{
      return p ?? p.stockCache.currentQuantity <= p.lowStockThreshold
    })
    
    return lowstock as any[]
  }
}
