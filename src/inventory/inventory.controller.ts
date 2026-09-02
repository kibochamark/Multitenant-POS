import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Version,
} from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import {
  AdjustStockDto,
  MovementQueryDto,
  RestockProductDto,
  WriteOffProductDto,
  InternalStockUseDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('shops/:shopId/products/:productId')
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);
  constructor(private readonly service: InventoryService) {}

  @Post('restock')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async restock(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: RestockProductDto,
  ) {
    this.logger.log(`Restock request received for product ${productId}`);
    const result = await this.service.restock(
      shopId,
      productId,
      request.user!.id,
      data,
    );
    return { status: 201, data: result, error: null };
  }

  @Get('stock-movements')
  @Version('1')
  @RequireShopAccess('shopId')
  async movements(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Query() query: MovementQueryDto,
  ) {
    this.logger.log(
      `Movement history request received for product ${productId}`,
    );
    const result = await this.service.listMovements(shopId, productId, query);
    return { status: 200, data: result, error: null };
  }

  @Post('write-offs')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async writeOff(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: WriteOffProductDto,
  ) {
    this.logger.log(`Write-off request received for product ${productId}`);
    const result = await this.service.writeOff(
      shopId,
      productId,
      request.user!.id,
      data,
    );
    return { status: 201, data: result, error: null };
  }

  @Post('internal-use')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async internalUse(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: InternalStockUseDto,
  ) {
    this.logger.log(`Internal stock-use request received for product ${productId}`);
    const canRecordOwnerPersonal = request.user!.defaultOwner || request.shopAccess?.role === 'OWNER';
    const result = await this.service.internalUse(shopId, productId, request.user!.id, canRecordOwnerPersonal, data);
    return { status: 201, data: result, error: null };
  }

  @Post('adjustments')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async adjust(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: AdjustStockDto,
  ) {
    this.logger.log(`Adjustment request received for product ${productId}`);
    const result = await this.service.adjust(
      shopId,
      productId,
      request.user!.id,
      data,
    );
    return { status: 201, data: result, error: null };
  }
}
