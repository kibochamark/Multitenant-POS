import {
  Body,
  Controller,
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
import { CartService } from './cart.service';
import { ActiveCartQueryDto, ScanBarcodeDto } from './dto/scan-barcode.dto';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { ApplyCartDiscountDto } from './dto/apply-cart-discount.dto';

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

  @Post(':cartId/abandon')
  @Version('1')
  @HttpCode(200)
  @RequireShopAccess('shopId')
  async abandon(
    @Param('shopId') shopId: string,
    @Param('cartId') cartId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: ActiveCartQueryDto,
  ) {
    this.logger.log(`Manual abandonment request received for cart ${cartId}`);
    const cart = await this.service.abandon(
      shopId,
      cartId,
      request.user!.id,
      data,
    );
    return { status: 200, data: cart, error: null };
  }

  @Patch(':cartId/items/:cartItemId/discount')
  @Version('1')
  @RequireShopAccess('shopId')
  async applyDiscount(
    @Param('shopId') shopId: string,
    @Param('cartId') cartId: string,
    @Param('cartItemId') cartItemId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: ApplyCartDiscountDto,
  ) {
    this.logger.log(`Discount request received for cart item ${cartItemId}`);
    return {
      status: 200,
      data: await this.service.applyDiscount(
        shopId,
        cartId,
        cartItemId,
        request.user!.id,
        data,
      ),
      error: null,
    };
  }

  @Post(':cartId/checkout')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId')
  async checkout(
    @Param('shopId') shopId: string,
    @Param('cartId') cartId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: CheckoutCartDto,
  ) {
    this.logger.log(`Checkout request received for cart ${cartId}`);
    // cartId is verified against the staff/station cart inside the repository;
    // retaining it in the route makes the operation explicit for API clients.
    const order = await this.service.checkout(
      shopId,
      cartId,
      request.user!.id,
      data,
    );
    return { status: 201, data: order, error: null };
  }
}
