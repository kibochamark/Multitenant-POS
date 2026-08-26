import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Product, StockMovementType } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { generateInternalEan13 } from './barcode.util';

export interface CreateProductData {
  name: string;
  barcode: string;
  price: Prisma.Decimal;
  costPrice: Prisma.Decimal;
  category?: string;
  minMarginPct?: number;
  minPrice?: Prisma.Decimal;
  lowStockThreshold?: number;
}

export interface ImportProductData extends CreateProductData {
  quantityAtHand: number;
}

export interface CreateServiceData {
  name: string;
  price: Prisma.Decimal;
  category?: string;
  createdById: string;
}

const serviceRecorderInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ServiceInclude;

@Injectable()
export class CatalogRepository {
  private readonly logger = new Logger(CatalogRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateAvailableBarcode(shopId: string) {
    this.logger.log(
      `Generating an available internal barcode for shop ${shopId}`,
    );
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const barcode = generateInternalEan13();
      const existing = await this.prisma.product.findUnique({
        where: { shopId_barcode: { shopId, barcode } },
        select: { id: true },
      });
      if (!existing) {
        this.logger.log(`Generated an available barcode for shop ${shopId}`);
        return barcode;
      }
      this.logger.warn(
        `Internal barcode collision on attempt ${attempt} for shop ${shopId}`,
      );
    }
    throw new Error('Could not generate an available barcode');
  }

  async createProduct(shopId: string, data: CreateProductData) {
    this.logger.log(`Creating product and stock cache for shop ${shopId}`);
    try {
      const product = await this.prisma.product.create({
        data: {
          shopId,
          ...data,
          stockCache: { create: { currentQuantity: 0 } },
        },
        include: { stockCache: true },
      });
      this.logger.log(`Created product ${product.id} with zero stock`);
      return product;
    } catch (error) {
      this.logger.error(`Failed to create product for shop ${shopId}`);
      throw error;
    }
  }

  async generateAvailableBarcodes(shopId: string, count: number) {
    const available = new Set<string>();
    while (available.size < count) {
      const candidates = Array.from({ length: count - available.size }, () => generateInternalEan13());
      const existing = await this.prisma.product.findMany({
        where: { shopId, barcode: { in: candidates } }, select: { barcode: true },
      });
      const taken = new Set(existing.map(({ barcode }) => barcode));
      candidates.forEach((barcode) => { if (!taken.has(barcode)) available.add(barcode); });
    }
    return [...available];
  }

  async importProductBatch(shopId: string, userId: string, rows: ImportProductData[]) {
    this.logger.log(`Importing product batch of ${rows.length} into shop ${shopId} by user ${userId}`);
    const barcodes = rows.map((row) => row.barcode);
    if (new Set(barcodes).size !== barcodes.length)
      throw new ConflictException('The generated batch contains duplicate barcodes');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({ where: { shopId, barcode: { in: barcodes } }, select: { barcode: true } });
      if (existing) throw new ConflictException(`Barcode ${existing.barcode} already exists in this shop`);

      const products = [];
      for (const row of rows) {
        const { quantityAtHand, ...productData } = row;
        const product = await tx.product.create({
          data: { shopId, ...productData, stockCache: { create: { currentQuantity: quantityAtHand } } },
          include: { stockCache: true },
        });
        await tx.stockMovement.create({ data: {
          productId: product.id, quantityDelta: quantityAtHand, type: StockMovementType.RESTOCK,
          createdById: userId, note: 'Opening quantity from bulk product import',
        } });
        products.push(product);
      }
      return products;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createService(shopId: string, data: CreateServiceData) {
    this.logger.log(`Creating service for shop ${shopId}`);
    try {
      const service = await this.prisma.service.create({
        data: { shopId, ...data },
        include: serviceRecorderInclude,
      });
      this.logger.log(`Created service ${service.id}`);
      return service;
    } catch (error) {
      this.logger.error(`Failed to create service for shop ${shopId}`);
      throw error;
    }
  }

  async listServices(
    shopId: string,
    options: {
      limit: number;
      cursor?: string;
      category?: string;
      isActive?: boolean;
    },
  ) {
    this.logger.log(`Listing services for shop ${shopId}`);
    return this.prisma.service.findMany({
      where: {
        shopId,
        ...(options.category ? { category: options.category } : {}),
        ...(options.isActive !== undefined
          ? { isActive: options.isActive }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: serviceRecorderInclude,
    });
  }

  async searchServices(
    shopId: string,
    query: string,
    limit: number,
    offset: number,
  ) {
    this.logger.log(`Searching services for shop ${shopId}`);
    return this.prisma.service.findMany({
      where: {
        shopId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit,
      skip: offset,
      include: serviceRecorderInclude,
    });
  }

  async findService(shopId: string, serviceId: string) {
    this.logger.log(`Finding service ${serviceId} in shop ${shopId}`);
    return this.prisma.service.findFirst({
      where: { id: serviceId, shopId },
      include: serviceRecorderInclude,
    });
  }

  async updateService(
    shopId: string,
    serviceId: string,
    data: Prisma.ServiceUpdateInput,
  ) {
    this.logger.log(`Updating service ${serviceId} in shop ${shopId}`);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.service.findFirst({
        where: { id: serviceId, shopId },
        select: { id: true },
      });
      if (!existing) return null;
      return tx.service.update({
        where: { id: serviceId },
        data,
        include: serviceRecorderInclude,
      });
    });
  }

  async deactivateService(shopId: string, serviceId: string) {
    this.logger.log(`Deactivating service ${serviceId} in shop ${shopId}`);
    return this.updateService(shopId, serviceId, { isActive: false });
  }

  async listProducts(
    shopId: string,
    options: {
      limit: number;
      cursor?: string;
      category?: string;
      isActive?: boolean;
    },
  ) {
    this.logger.log(`Listing products for shop ${shopId}`);
    const rows = await this.prisma.product.findMany({
      where: {
        shopId,
        ...(options.category ? { category: options.category } : {}),
        ...(options.isActive !== undefined
          ? { isActive: options.isActive }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: { stockCache: true },
    });
    this.logger.log(`Found ${rows.length} product rows for shop ${shopId}`);
    return rows;
  }

  async findProduct(shopId: string, productId: string) {
    this.logger.log(`Finding product ${productId} in shop ${shopId}`);
    return this.prisma.product.findFirst({
      where: { id: productId, shopId },
      include: { stockCache: true },
    });
  }

  async findByBarcode(shopId: string, barcode: string) {
    this.logger.log(`Looking up barcode in shop ${shopId}`);
    return this.prisma.product.findUnique({
      where: { shopId_barcode: { shopId, barcode } },
      include: { stockCache: true },
    });
  }

  async searchProducts(
    shopId: string,
    query: string,
    limit: number,
    offset: number,
  ) {
    this.logger.log(`Searching products for shop ${shopId}`);
    const rows = await this.prisma.$queryRaw<
      Array<Product & { currentQuantity: number }>
    >(Prisma.sql`
      SELECT p.*, sc."currentQuantity" AS "currentQuantity",
        ts_rank(
          to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.barcode, '') || ' ' || coalesce(p.category, '')),
          websearch_to_tsquery('simple', ${query})
        ) AS rank
      FROM products p
      LEFT JOIN stock_cache sc ON sc."productId" = p.id
      WHERE p."shopId" = ${shopId}
        AND p."isActive" = true
        AND to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.barcode, '') || ' ' || coalesce(p.category, ''))
          @@ websearch_to_tsquery('simple', ${query})
      ORDER BY rank DESC, p.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `);
    this.logger.log(
      `Search returned ${rows.length} products for shop ${shopId}`,
    );
    return rows;
  }

  async listLowStockProducts(
    shopId: string,
    limit: number,
    offset: number,
  ) {
    this.logger.log(`Listing low-stock products for shop ${shopId}`);
    return this.prisma.$queryRaw<
      Array<Product & { currentQuantity: number }>
    >(Prisma.sql`
      SELECT p.*, sc."currentQuantity" AS "currentQuantity"
      FROM products p
      INNER JOIN stock_cache sc ON sc."productId" = p.id
      WHERE p."shopId" = ${shopId}
        AND p."isActive" = true
        AND sc."currentQuantity" <= p."lowStockThreshold"
      ORDER BY sc."currentQuantity" ASC, p.name ASC, p.id ASC
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  async updateProduct(
    shopId: string,
    productId: string,
    data: Prisma.ProductUpdateInput,
  ) {
    this.logger.log(`Updating product ${productId} in shop ${shopId}`);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id: productId, shopId },
        select: { id: true },
      });
      if (!existing) return null;
      return tx.product.update({
        where: { id: productId },
        data,
        include: { stockCache: true },
      });
    });
  }

  async deactivateProduct(shopId: string, productId: string) {
    this.logger.log(`Deactivating product ${productId} in shop ${shopId}`);
    return this.updateProduct(shopId, productId, { isActive: false });
  }


  async reactivateProduct(shopId: string, productId: string) {
    this.logger.log(`Reactivating product ${productId} in shop ${shopId}`);
    return this.updateProduct(shopId, productId, { isActive: true });
  }
}
