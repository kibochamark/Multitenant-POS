import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AccountPurpose, AccountingEventType, AccountingSourceType, InternalStockUseType, JournalSide, Prisma, StockMovementType } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { AccountSeederService } from 'src/accounting/account-seeder.service';
import { AccountingPostingService } from 'src/accounting/accounting-posting.service';

const movementRecorderInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.StockMovementInclude;

@Injectable()
export class InventoryRepository {
  private readonly logger = new Logger(InventoryRepository.name);

  constructor(private readonly prisma: PrismaService, private readonly accountSeeder: AccountSeederService, private readonly accounting: AccountingPostingService) {}

  async restock(
    shopId: string,
    productId: string,
    quantity: number,
    userId: string,
    note?: string,
  ) {
    this.logger.log(`Restocking product ${productId} by ${quantity}`);
    return this.prisma.$transaction(async (tx) => {
      await this.assertProduct(tx, shopId, productId);
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          quantityDelta: quantity,
          type: StockMovementType.RESTOCK,
          createdById: userId,
          ...(note ? { note } : {}),
        },
        include: movementRecorderInclude,
      });
      const stockCache = await tx.stockCache.update({
        where: { productId },
        data: { currentQuantity: { increment: quantity } },
      });
      return { movement, stockCache };
    });
  }

  async writeOff(
    shopId: string,
    productId: string,
    quantity: number,
    reason: string,
    userId: string,
    note?: string,
  ) {
    this.logger.log(`Writing off ${quantity} units of product ${productId}`);
    return this.prisma.$transaction(async (tx) => {
      await this.assertProduct(tx, shopId, productId);
      const updated = await tx.stockCache.updateMany({
        where: { productId, currentQuantity: { gte: quantity } },
        data: { currentQuantity: { decrement: quantity } },
      });
      if (updated.count !== 1)
        throw new ConflictException('Insufficient stock for this write-off');
      const writeOff = await tx.writeOff.create({
        data: {
          shopId,
          productId,
          staffId: userId,
          quantity,
          reason,
          ...(note ? { note } : {}),
        },
      });
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          quantityDelta: -quantity,
          type: StockMovementType.WRITE_OFF,
          referenceId: writeOff.id,
          createdById: userId,
          note: [reason, note].filter(Boolean).join(': '),
        },
        include: movementRecorderInclude,
      });
      const stockCache = await tx.stockCache.findUniqueOrThrow({
        where: { productId },
      });
      return { writeOff, movement, stockCache };
    });
  }

  async internalUse(shopId: string, productId: string, quantity: number, type: InternalStockUseType, reason: string, userId: string, canRecordOwnerPersonal: boolean, note?: string) {
    this.logger.log(`Recording ${quantity} units of product ${productId} for ${type}`);
    if (type === InternalStockUseType.OWNER_PERSONAL && !canRecordOwnerPersonal)
      throw new ConflictException('Only an owner can record owner personal use');
    return await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, shopId, isActive: true }, select: { id: true, name: true, costPrice: true, shop: { select: { companyId: true } } } });
      if (!product) throw new NotFoundException('Active product not found in this shop');
      if (!product.costPrice.isPositive()) throw new ConflictException('Set a positive product cost before recording internal use');
      const updated = await tx.stockCache.updateMany({ where: { productId, currentQuantity: { gte: quantity } }, data: { currentQuantity: { decrement: quantity } } });
      if (updated.count !== 1) throw new ConflictException('Insufficient stock for internal use');
      const totalCost = product.costPrice.mul(quantity).toDecimalPlaces(2);
      const usage = await tx.internalStockUse.create({ data: { shopId, productId, usedById: userId, type, quantity, unitCostSnapshot: product.costPrice, totalCost, reason, note } });
      const movement = await tx.stockMovement.create({ data: { productId, quantityDelta: -quantity, type: StockMovementType.INTERNAL_USE, referenceId: usage.id, createdById: userId, note: [String(type).replace(/_/g, ' '), reason, note].filter(Boolean).join(': ') }, include: movementRecorderInclude });
      const debitPurpose = type === InternalStockUseType.OWNER_PERSONAL
        ? AccountPurpose.OWNER_DRAWINGS
        : type === InternalStockUseType.SERVICE_MATERIAL
          ? AccountPurpose.SERVICE_MATERIAL_EXPENSE
          : type === InternalStockUseType.PROMOTION
            ? AccountPurpose.MARKETING_EXPENSE
            : AccountPurpose.INTERNAL_USE_EXPENSE;
      await this.accountSeeder.initializeInTransaction(tx, product.shop.companyId, shopId);
      await this.accounting.post(tx, { companyId: product.shop.companyId, shopId, recordedById: userId, eventType: AccountingEventType.INTERNAL_STOCK_USE, transactionDate: new Date(), description: `${product.name} used internally: ${reason}`, source: { type: AccountingSourceType.INTERNAL_STOCK_USE, id: usage.id }, lines: [
        { purpose: debitPurpose, side: JournalSide.DEBIT, amount: totalCost },
        { purpose: AccountPurpose.INVENTORY, side: JournalSide.CREDIT, amount: totalCost },
      ] });
      const stockCache = await tx.stockCache.findUniqueOrThrow({ where: { productId } });
      return { usage, movement, stockCache };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async adjust(
    shopId: string,
    productId: string,
    quantityDelta: number,
    reason: string,
    userId: string,
    note?: string,
  ) {
    this.logger.log(`Adjusting product ${productId} by ${quantityDelta}`);
    return this.prisma.$transaction(async (tx) => {
      await this.assertProduct(tx, shopId, productId);
      if (quantityDelta < 0) {
        const required = Math.abs(quantityDelta);
        const updated = await tx.stockCache.updateMany({
          where: { productId, currentQuantity: { gte: required } },
          data: { currentQuantity: { decrement: required } },
        });
        if (updated.count !== 1)
          throw new ConflictException('Adjustment would make stock negative');
      } else {
        await tx.stockCache.update({
          where: { productId },
          data: { currentQuantity: { increment: quantityDelta } },
        });
      }
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          quantityDelta,
          type: StockMovementType.ADJUSTMENT,
          createdById: userId,
          note: [reason, note].filter(Boolean).join(': '),
        },
        include: movementRecorderInclude,
      });
      const stockCache = await tx.stockCache.findUniqueOrThrow({
        where: { productId },
      });
      return { movement, stockCache };
    });
  }

  async listMovements(
    shopId: string,
    productId: string,
    limit: number,
    cursor?: string,
  ) {
    this.logger.log(`Listing stock movements for product ${productId}`);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.stockMovement.findMany({
      where: { productId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: movementRecorderInclude,
    });
  }

  private async assertProduct(
    tx: Prisma.TransactionClient,
    shopId: string,
    productId: string,
  ) {
    const product = await tx.product.findFirst({
      where: { id: productId, shopId, isActive: true },
      select: { id: true },
    });
    if (!product)
      throw new NotFoundException('Active product not found in this shop');
  }
}
