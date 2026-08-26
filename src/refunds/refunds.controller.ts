import { Body, Controller, Logger, Param, Post, Req, Version } from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundsService } from './refunds.service';

@Controller('shops/:shopId/orders/:orderId/refunds')
export class RefundsController {
  private readonly logger = new Logger(RefundsController.name);
  constructor(private readonly service: RefundsService) {}
  @Post() @Version('1') @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async create(@Param('shopId') shopId: string, @Param('orderId') orderId: string, @Req() request: AuthenticatedRequest, @Body() data: CreateRefundDto) {
    this.logger.log(`Refund request received for order ${orderId}`);
    return { status: 201, data: await this.service.create(shopId, orderId, request.user!.id, data), error: null };
  }
}
