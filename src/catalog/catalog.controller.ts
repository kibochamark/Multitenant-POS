import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Version,
} from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { CatalogService } from './catalog.service';
import {
  ProductListQueryDto,
  ProductSearchQueryDto,
  LowStockQueryDto,
} from './dto/catalog-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  ServiceListQueryDto,
  ServiceSearchQueryDto,
} from './dto/service-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Controller('shops/:shopId')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(private readonly catalogService: CatalogService) {}

  @Post('products/barcodes/generate')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async generateBarcode(@Param('shopId') shopId: string) {
    this.logger.log(`Barcode generation request received for shop ${shopId}`);
    const barcode = await this.catalogService.generateBarcode(shopId);
    return { status: 201, data: barcode, error: null };
  }

  @Get('products')
  @Version('1')
  @RequireShopAccess('shopId')
  async listProducts(
    @Param('shopId') shopId: string,
    @Query() query: ProductListQueryDto,
  ) {
    this.logger.log(`Product list request received for shop ${shopId}`);
    const result = await this.catalogService.listProducts(shopId, query);
    return { status: 200, data: result, error: null };
  }

  @Get('products/search')
  @Version('1')
  @RequireShopAccess('shopId')
  async searchProducts(
    @Param('shopId') shopId: string,
    @Query() query: ProductSearchQueryDto,
  ) {
    this.logger.log(`Product search request received for shop ${shopId}`);
    const result = await this.catalogService.searchProducts(shopId, query);
    return { status: 200, data: result, error: null };
  }

  @Get('products/low-stock')
  @Version('1')
  @RequireShopAccess('shopId')
  async listLowStockProducts(
    @Param('shopId') shopId: string,
    @Query() query: LowStockQueryDto,
  ) {
    this.logger.log(`Low-stock request received for shop ${shopId}`);
    return {
      status: 200,
      data: await this.catalogService.listLowStockProducts(shopId, query),
      error: null,
    };
  }

  @Get('products/barcode/:barcode')
  @Version('1')
  @RequireShopAccess('shopId')
  async getProductByBarcode(
    @Param('shopId') shopId: string,
    @Param('barcode') barcode: string,
  ) {
    this.logger.log(`Barcode lookup request received for shop ${shopId}`);
    const product = await this.catalogService.getByBarcode(shopId, barcode);
    return { status: 200, data: product, error: null };
  }

  @Get('products/:productId')
  @Version('1')
  @RequireShopAccess('shopId')
  async getProduct(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    this.logger.log(`Product detail request received for ${productId}`);
    const product = await this.catalogService.getProduct(shopId, productId);
    return { status: 200, data: product, error: null };
  }

  @Patch('products/:productId')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async updateProduct(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Body() data: UpdateProductDto,
  ) {
    this.logger.log(`Product update request received for ${productId}`);
    const product = await this.catalogService.updateProduct(
      shopId,
      productId,
      data,
    );
    return { status: 200, data: product, error: null };
  }

  @Delete('products/:productId')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async deleteProduct(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    this.logger.log(`Product deactivation request received for ${productId}`);
    const product = await this.catalogService.deactivateProduct(
      shopId,
      productId,
    );
    return { status: 200, data: product, error: null };
  }

  @Patch('products/:productId/reactivate')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async reactivateProduct(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    this.logger.log(`Product reactivation request received for ${productId}`);
    return {
      status: 200,
      data: await this.catalogService.reactivateProduct(shopId, productId),
      error: null,
    };
  }

  @Post('products')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async createProduct(
    @Param('shopId') shopId: string,
    @Body() data: CreateProductDto,
  ) {
    this.logger.log(`Product creation request received for shop ${shopId}`);
    const product = await this.catalogService.createProduct(shopId, data);
    this.logger.log(`Product creation request completed for shop ${shopId}`);
    return { status: 201, data: product, error: null };
  }

  @Post('services')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async createService(
    @Param('shopId') shopId: string,
    @Body() data: CreateServiceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    this.logger.log(`Service creation request received for shop ${shopId}`);
    const service = await this.catalogService.createService(
      shopId,
      request.user!.id,
      data,
    );
    this.logger.log(`Service creation request completed for shop ${shopId}`);
    return { status: 201, data: service, error: null };
  }

  @Get('services')
  @Version('1')
  @RequireShopAccess('shopId')
  async listServices(
    @Param('shopId') shopId: string,
    @Query() query: ServiceListQueryDto,
  ) {
    this.logger.log(`Service list request received for shop ${shopId}`);
    return {
      status: 200,
      data: await this.catalogService.listServices(shopId, query),
      error: null,
    };
  }

  @Get('services/search')
  @Version('1')
  @RequireShopAccess('shopId')
  async searchServices(
    @Param('shopId') shopId: string,
    @Query() query: ServiceSearchQueryDto,
  ) {
    this.logger.log(`Service search request received for shop ${shopId}`);
    return {
      status: 200,
      data: await this.catalogService.searchServices(shopId, query),
      error: null,
    };
  }

  @Get('services/:serviceId')
  @Version('1')
  @RequireShopAccess('shopId')
  async getService(
    @Param('shopId') shopId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return {
      status: 200,
      data: await this.catalogService.getService(shopId, serviceId),
      error: null,
    };
  }

  @Patch('services/:serviceId')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async updateService(
    @Param('shopId') shopId: string,
    @Param('serviceId') serviceId: string,
    @Body() data: UpdateServiceDto,
  ) {
    this.logger.log(`Service update request received for ${serviceId}`);
    return {
      status: 200,
      data: await this.catalogService.updateService(shopId, serviceId, data),
      error: null,
    };
  }

  @Delete('services/:serviceId')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async deleteService(
    @Param('shopId') shopId: string,
    @Param('serviceId') serviceId: string,
  ) {
    this.logger.log(`Service deactivation request received for ${serviceId}`);
    return {
      status: 200,
      data: await this.catalogService.deactivateService(shopId, serviceId),
      error: null,
    };
  }
}
