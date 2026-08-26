import { Body, Controller, Get, Logger, Param, Post, Query, Req, Version } from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';
import { OrdersService } from './orders.service';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { CancelOrderDto } from './dto/cancel-order.dto';

@Controller('shops/:shopId/orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);
  constructor(private readonly service: OrdersService) {}

  @Get()
  @Version('1')
  @RequireShopAccess('shopId')
  async history(
    @Param('shopId') shopId: string,
    @Query() query: OrderHistoryQueryDto,
  ) {
    this.logger.log(`Order history request received for shop ${shopId}`);
    return {
      status: 200,
      data: await this.service.history(shopId, query),
      error: null,
    };
  }

  @Get(':orderId')
  @Version('1')
  @RequireShopAccess('shopId')
  async get(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
  ) {
    this.logger.log(`Order detail request received for order ${orderId}`);
    return {
      status: 200,
      data: await this.service.get(shopId, orderId),
      error: null,
    };
  }

  @Post(':orderId/cancel')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async cancel(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: CancelOrderDto,
  ) {
    this.logger.log(`Order cancellation request received for ${orderId}`);
    return {
      status: 200,
      data: await this.service.cancel(shopId, orderId, request.user!.id, data.reason),
      error: null,
    };
  }
}
