import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

const movementRecorderInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.StockMovementInclude;

@Injectable()
export class InventoryRepository {
  private readonly logger = new Logger(InventoryRepository.name);

  constructor(private readonly prisma: PrismaService) {}

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
