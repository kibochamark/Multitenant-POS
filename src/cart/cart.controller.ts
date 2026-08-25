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
import { CartService } from './cart.service';
import { ActiveCartQueryDto, ScanBarcodeDto } from './dto/scan-barcode.dto';

@Controller('shops/:shopId/carts')
export class CartController {
  private readonly logger = new Logger(CartController.name);
  constructor(private readonly service: CartService) {}

  @Get('active')
  @Version('1')
  @RequireShopAccess('shopId')
  async getActiveCart(
    @Param('shopId') shopId: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: ActiveCartQueryDto,
  ) {
    this.logger.log(`Active cart request received for shop ${shopId}`);
    return {
      status: 200,
      data: {
        cart: await this.service.getActiveCart(shopId, request.user!.id, query),
      },
      error: null,
    };
  }

  @Post('active/items/scan')
  @Version('1')
  @HttpCode(200)
  @RequireShopAccess('shopId')
  async scanProduct(
    @Param('shopId') shopId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: ScanBarcodeDto,
  ) {
    this.logger.log(`Barcode scan request received for shop ${shopId}`);
    return {
      status: 200,
      data: await this.service.scanProduct(shopId, request.user!.id, data),
      error: null,
    };
  }
}
