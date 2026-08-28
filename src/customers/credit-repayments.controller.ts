import { Body, Controller, Get, Logger, Param, Patch, Post, Req, Version } from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { CreditRepaymentsService } from './credit-repayments.service';
import { CashCreditRepaymentDto, CreditAdjustmentDto, MpesaCreditRepaymentDto, VerifyCreditRepaymentDto } from './dto/credit-repayment.dto';

@Controller('shops/:shopId/customers/:customerId')
export class CreditRepaymentsController {
  private readonly logger = new Logger(CreditRepaymentsController.name);
  constructor(private readonly service: CreditRepaymentsService) {}
  @Get('credit-account') @Version('1') @RequireShopAccess('shopId')
  async account(@Param('customerId') customerId: string, @Req() request: AuthenticatedRequest) { return { status: 200, data: await this.service.account(request.user!.companyId, customerId), error: null }; }
  @Post('credit-repayments/cash') @Version('1') @RequireShopAccess('shopId')
  async cash(@Param('shopId') shopId: string, @Param('customerId') customerId: string, @Req() request: AuthenticatedRequest, @Body() data: CashCreditRepaymentDto) { this.logger.log(`Cash repayment request for customer ${customerId}`); return { status: 201, data: await this.service.cash(request.user!.companyId, shopId, customerId, request.user!.id, data), error: null }; }
  @Post('credit-repayments/mpesa') @Version('1') @RequireShopAccess('shopId')
  async mpesa(@Param('shopId') shopId: string, @Param('customerId') customerId: string, @Req() request: AuthenticatedRequest, @Body() data: MpesaCreditRepaymentDto) { this.logger.log(`M-Pesa repayment request for customer ${customerId}`); return { status: 201, data: await this.service.mpesa(request.user!.companyId, shopId, customerId, request.user!.id, data), error: null }; }
  @Patch('credit-repayments/:repaymentId/verify') @Version('1') @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async verify(@Param('shopId') shopId: string, @Param('customerId') customerId: string, @Param('repaymentId') repaymentId: string, @Req() request: AuthenticatedRequest, @Body() data: VerifyCreditRepaymentDto) { return { status: 200, data: await this.service.verify(request.user!.companyId, shopId, customerId, repaymentId, request.user!.id, data), error: null }; }

  @Post('credit-adjustments') @Version('1') @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async adjust(@Param('shopId') shopId: string, @Param('customerId') customerId: string, @Req() request: AuthenticatedRequest, @Body() data: CreditAdjustmentDto) {
    this.logger.log(`Credit adjustment request for customer ${customerId}`);
    return { status: 201, data: await this.service.adjust(request.user!.companyId, shopId, customerId, request.user!.id, data), error: null };
  }
}
