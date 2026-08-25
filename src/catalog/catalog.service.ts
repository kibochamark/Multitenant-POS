import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { CatalogRepository } from './catalog.repository';
import {
  ProductListQueryDto,
  ProductSearchQueryDto,
  LowStockQueryDto,
} from './dto/catalog-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  ServiceListQueryDto,
  ServiceSearchQueryDto,
} from './dto/service-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly catalogRepository: CatalogRepository) {}

  async generateBarcode(shopId: string) {
    this.logger.log(`Preparing internal barcode generation for shop ${shopId}`);
    const barcode =
      await this.catalogRepository.generateAvailableBarcode(shopId);
    return { barcode, format: 'EAN_13' as const };
  }

  async createProduct(shopId: string, data: CreateProductDto) {
    this.logger.log(`Preparing product creation for shop ${shopId}`);
    try {
      const product = await this.catalogRepository.createProduct(shopId, {
        name: data.name.trim(),
        barcode: data.barcode.trim(),
        price: new Prisma.Decimal(data.price),
        costPrice: new Prisma.Decimal(data.costPrice),
        ...(data.category?.trim() ? { category: data.category.trim() } : {}),
        ...(data.minMarginPct !== undefined
          ? { minMarginPct: data.minMarginPct }
          : {}),
        ...(data.minPrice !== undefined
          ? { minPrice: new Prisma.Decimal(data.minPrice) }
          : {}),
        ...(data.lowStockThreshold !== undefined
          ? { lowStockThreshold: data.lowStockThreshold }
          : {}),
      });
      this.logger.log(`Product ${product.id} is ready for shop ${shopId}`);
      return this.withStockStatus(product);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(`Duplicate barcode rejected for shop ${shopId}`);
        throw new ConflictException(
          'A product with this barcode already exists in this shop',
        );
      }
      this.logger.error(`Product creation failed for shop ${shopId}`);
      throw error;
    }
  }

  async createService(
    shopId: string,
    createdById: string,
    data: CreateServiceDto,
  ) {
    this.logger.log(`Preparing service creation for shop ${shopId}`);
    try {
      const service = await this.catalogRepository.createService(shopId, {
        name: data.name.trim(),
        price: new Prisma.Decimal(data.price),
        createdById,
        ...(data.category?.trim() ? { category: data.category.trim() } : {}),
      });
      this.logger.log(`Service ${service.id} is ready for shop ${shopId}`);
      return service;
    } catch (error) {
      this.logger.error(`Service creation failed for shop ${shopId}`);
      throw error;
    }
  }

  async listServices(shopId: string, query: ServiceListQueryDto) {
    this.logger.log(`Listing catalog services for shop ${shopId}`);
    const limit = Number(query.limit ?? 25);
    const rows = await this.catalogRepository.listServices(shopId, {
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.category?.trim() ? { category: query.category.trim() } : {}),
      ...(query.active
        ? { isActive: query.active === 'true' }
        : { isActive: true }),
    });
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? (items[items.length - 1]?.id ?? null) : null,
      },
    };
  }

  async searchServices(shopId: string, query: ServiceSearchQueryDto) {
    this.logger.log(`Searching catalog services for shop ${shopId}`);
    const limit = Number(query.limit ?? 25);
    const page = Number(query.page ?? 1);
    const items = await this.catalogRepository.searchServices(
      shopId,
      query.q.trim(),
      limit,
      (page - 1) * limit,
    );
    return {
      items,
      pageInfo: { page, limit, hasNextPage: items.length === limit },
    };
  }

  async getService(shopId: string, serviceId: string) {
    this.logger.log(`Getting service ${serviceId} for shop ${shopId}`);
    const service = await this.catalogRepository.findService(shopId, serviceId);
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async updateService(
    shopId: string,
    serviceId: string,
    data: UpdateServiceDto,
  ) {
    this.logger.log(`Preparing update for service ${serviceId}`);
    const service = await this.catalogRepository.updateService(
      shopId,
      serviceId,
      {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.price !== undefined
          ? { price: new Prisma.Decimal(data.price) }
          : {}),
        ...(data.category !== undefined
          ? { category: data.category.trim() || null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    );
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async deactivateService(shopId: string, serviceId: string) {
    this.logger.log(`Deactivating service ${serviceId}`);
    const service = await this.catalogRepository.deactivateService(
      shopId,
      serviceId,
    );
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async listProducts(shopId: string, query: ProductListQueryDto) {
    this.logger.log(`Listing catalog products for shop ${shopId}`);
    const limit = Number(query.limit ?? 25);
    const rows = await this.catalogRepository.listProducts(shopId, {
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.category?.trim() ? { category: query.category.trim() } : {}),
      ...(query.active
        ? { isActive: query.active === 'true' }
        : { isActive: true }),
    });
    const hasNextPage = rows.length > limit;
    const items = (hasNextPage ? rows.slice(0, limit) : rows).map((product) =>
      this.withStockStatus(product),
    );
    this.logger.log(`Catalog listing completed for shop ${shopId}`);
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? (items[items.length - 1]?.id ?? null) : null,
      },
    };
  }

  async getProduct(shopId: string, productId: string) {
    this.logger.log(`Getting product ${productId} for shop ${shopId}`);
    const product = await this.catalogRepository.findProduct(shopId, productId);
    if (!product) throw new NotFoundException('Product not found');
    return this.withStockStatus(product);
  }

  async getByBarcode(shopId: string, barcode: string) {
    this.logger.log(`Getting product by barcode for shop ${shopId}`);
    const product = await this.catalogRepository.findByBarcode(
      shopId,
      barcode.trim(),
    );
    if (!product || !product.isActive)
      throw new NotFoundException('Product not found');
    return this.withStockStatus(product);
  }

  async searchProducts(shopId: string, query: ProductSearchQueryDto) {
    this.logger.log(`Searching catalog for shop ${shopId}`);
    const limit = Number(query.limit ?? 25);
    const page = Number(query.page ?? 1);
    const rows = await this.catalogRepository.searchProducts(
      shopId,
      query.q.trim(),
      limit,
      (page - 1) * limit,
    );
    const items = rows.map((product) => this.withStockStatus(product));
    return {
      items,
      pageInfo: { page, limit, hasNextPage: rows.length === limit },
    };
  }

  async updateProduct(
    shopId: string,
    productId: string,
    data: UpdateProductDto,
  ) {
    this.logger.log(`Preparing update for product ${productId}`);
    try {
      const product = await this.catalogRepository.updateProduct(
        shopId,
        productId,
        {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.barcode !== undefined
            ? { barcode: data.barcode.trim() }
            : {}),
          ...(data.price !== undefined
            ? { price: new Prisma.Decimal(data.price) }
            : {}),
          ...(data.costPrice !== undefined
            ? { costPrice: new Prisma.Decimal(data.costPrice) }
            : {}),
          ...(data.category !== undefined
            ? { category: data.category.trim() || null }
            : {}),
          ...(data.minMarginPct !== undefined
            ? { minMarginPct: data.minMarginPct }
            : {}),
          ...(data.minPrice !== undefined
            ? { minPrice: new Prisma.Decimal(data.minPrice) }
            : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.lowStockThreshold !== undefined
            ? { lowStockThreshold: data.lowStockThreshold }
            : {}),
        },
      );
      if (!product) throw new NotFoundException('Product not found');
      this.logger.log(`Updated product ${productId}`);
      return this.withStockStatus(product);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A product with this barcode already exists in this shop',
        );
      }
      throw error;
    }
  }

  async deactivateProduct(shopId: string, productId: string) {
    this.logger.log(`Deactivating product ${productId}`);
    const product = await this.catalogRepository.deactivateProduct(
      shopId,
      productId,
    );
    if (!product) throw new NotFoundException('Product not found');
    return this.withStockStatus(product);
  }

  async reactivateProduct(shopId: string, productId: string) {
    this.logger.log(`Reactivating product ${productId}`);
    const product = await this.catalogRepository.reactivateProduct(
      shopId,
      productId,
    );
    if (!product) throw new NotFoundException('Product not found');
    return this.withStockStatus(product);
  }

  async listLowStockProducts(shopId: string, query: LowStockQueryDto) {
    this.logger.log(`Preparing low-stock list for shop ${shopId}`);
    const limit = Number(query.limit ?? 25);
    const page = Number(query.page ?? 1);
    const rows = await this.catalogRepository.listLowStockProducts(
      shopId,
      limit,
      (page - 1) * limit,
    );
    return {
      items: rows.map((product) => this.withStockStatus(product)),
      pageInfo: { page, limit, hasNextPage: rows.length === limit },
    };
  }

  private withStockStatus<
    T extends {
      isActive: boolean;
      lowStockThreshold: number;
      stockCache?: { currentQuantity: number } | null;
      currentQuantity?: unknown;
    },
  >(product: T) {
    const currentQuantity = Number(
      product.stockCache?.currentQuantity ?? product.currentQuantity ?? 0,
    );
    const stockStatus = !product.isActive
      ? ('INACTIVE' as const)
      : currentQuantity <= 0
        ? ('OUT_OF_STOCK' as const)
        : currentQuantity <= product.lowStockThreshold
          ? ('LOW_STOCK' as const)
          : ('IN_STOCK' as const);
    return { ...product, stockStatus };
  }
}
