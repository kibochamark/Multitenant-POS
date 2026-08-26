import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Version,
} from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import {
  AmountDto,
  CreditPaymentDto,
  ManualMpesaPaymentDto,
  VerifyMpesaPaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('shops/:shopId/orders/:orderId')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(private readonly service: PaymentsService) {}

  @Post('payments/cash')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId')
  async cash(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: AmountDto,
  ) {
    this.logger.log(`Cash payment request for order ${orderId}`);
    return {
      status: 201,
      data: await this.service.recordCash(
        shopId,
        orderId,
        request.user!.id,
        data,
      ),
      error: null,
    };
  }

  @Post('payments/mpesa/manual')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId')
  async mpesa(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: ManualMpesaPaymentDto,
  ) {
    this.logger.log(`M-Pesa payment request for order ${orderId}`);
    return {
      status: 201,
      data: await this.service.recordManualMpesa(
        shopId,
        orderId,
        request.user!.id,
        data,
      ),
      error: null,
    };
  }

  @Post('payments/credit')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId')
  async credit(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: CreditPaymentDto,
  ) {
    this.logger.log(`Credit payment request for order ${orderId}`);
    return {
      status: 201,
      data: await this.service.recordCredit(
        shopId,
        orderId,
        request.user!.id,
        data,
      ),
      error: null,
    };
  }

  @Patch('payments/:paymentId/verify')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async verify(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('paymentId') paymentId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: VerifyMpesaPaymentDto,
  ) {
    this.logger.log(`M-Pesa verification request for payment ${paymentId}`);
    return {
      status: 200,
      data: await this.service.verifyManualMpesa(
        shopId,
        orderId,
        paymentId,
        request.user!.id,
        data,
      ),
      error: null,
    };
  }
}
