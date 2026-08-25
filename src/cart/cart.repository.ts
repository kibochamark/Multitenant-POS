import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CartStatus, ItemType, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class CartRepository {
  private readonly logger = new Logger(CartRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  async scanProduct(
    shopId: string,
    staffId: string,
    stationId: string,
    barcode: string,
  ) {
    this.logger.log(`Adding scanned barcode to cart in shop ${shopId}`);
    const activeKey = `${shopId}:${staffId}:${stationId}`;

    return this.prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({
          where: { shopId_barcode: { shopId, barcode } },
          select: {
            id: true,
            name: true,
            barcode: true,
            price: true,
            isActive: true,
            stockCache: { select: { currentQuantity: true } },
          },
        });
        if (!product?.isActive) {
          throw new NotFoundException(
            'No active product with this barcode exists in this shop',
          );
        }

        const cart = await tx.cart.upsert({
          where: { activeKey },
          create: {
            shopId,
            staffId,
            stationId,
            activeKey,
            status: CartStatus.ACTIVE,
          },
          update: { updatedAt: new Date() },
          select: { id: true },
        });

        await tx.cartItem.upsert({
          where: {
            cartId_itemType_itemId: {
              cartId: cart.id,
              itemType: ItemType.PRODUCT,
              itemId: product.id,
            },
          },
          create: {
            cartId: cart.id,
            itemType: ItemType.PRODUCT,
            itemId: product.id,
            quantity: 1,
            originalUnitPrice: product.price,
            finalUnitPrice: product.price,
          },
          update: { quantity: { increment: 1 } },
        });

        // Prisma's @updatedAt is not triggered by a CartItem write, so this
        // explicit update keeps abandoned-cart cleanup based on real activity.
        await tx.cart.update({
          where: { id: cart.id },
          data: { updatedAt: new Date() },
        });

        const result = await tx.cart.findUniqueOrThrow({
          where: { id: cart.id },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        });
        return this.hydrateProducts(tx, result);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getActiveCart(shopId: string, staffId: string, stationId: string) {
    this.logger.log(`Finding active cart in shop ${shopId}`);
    const activeKey = `${shopId}:${staffId}:${stationId}`;
    const cart = await this.prisma.cart.findUnique({
      where: { activeKey },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!cart) return null;
    return this.hydrateProducts(this.prisma, cart);
  }

  private async hydrateProducts(
    client: Prisma.TransactionClient | PrismaService,
    cart: {
      items: Array<{ itemType: ItemType; itemId: string }>;
      [key: string]: unknown;
    },
  ) {
    const productIds = cart.items
      .filter((item) => item.itemType === ItemType.PRODUCT)
      .map((item) => item.itemId);
    const products = await client.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, barcode: true, isActive: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return {
      ...cart,
      items: cart.items.map((item) => ({
        ...item,
        product:
          item.itemType === ItemType.PRODUCT
            ? (byId.get(item.itemId) ?? null)
            : null,
      })),
    };
  }
}
