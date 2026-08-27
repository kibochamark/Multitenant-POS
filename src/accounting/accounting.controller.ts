import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Version } from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { AccountingService } from './accounting.service';
import { CreateManualJournalDto, RecordUnallocatedInventoryPurchaseDto } from './dto/accounting.dto';

@Controller('shops/:shopId/accounting')
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  @Post('initialize')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER')
  async initialize(@Param('shopId') shopId: string, @Req() request: AuthenticatedRequest) {
    return { status: 201, data: await this.service.initialize(request.user!.companyId, shopId), error: null };
  }

  @Get('accounts')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER')
  async accounts(@Param('shopId') shopId: string, @Req() request: AuthenticatedRequest) {
    return { status: 200, data: await this.service.accounts(request.user!.companyId, shopId), error: null };
  }

  @Get('journal')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER')
  async journal(@Param('shopId') shopId: string, @Req() request: AuthenticatedRequest, @Query('limit') limit?: string) {
    return { status: 200, data: await this.service.journal(request.user!.companyId, shopId, limit), error: null };
  }

  @Get('daily-balances')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER')
  async dailyBalances(
    @Param('shopId') shopId: string,
    @Req() request: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return { status: 200, data: await this.service.dailyBalances(request.user!.companyId, shopId, from, to), error: null };
  }

  @Post('manual-journals')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER')
  async manual(@Param('shopId') shopId: string, @Req() request: AuthenticatedRequest, @Body() data: CreateManualJournalDto) {
    return { status: 201, data: await this.service.manual(request.user!.companyId, shopId, request.user!.id, data), error: null };
  }

  @Post('unallocated-inventory-purchases')
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER')
  async unallocatedPurchase(
    @Param('shopId') shopId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: RecordUnallocatedInventoryPurchaseDto,
  ) {
    return {
      status: 201,
      data: await this.service.unallocatedPurchase(request.user!.companyId, shopId, request.user!.id, data),
      error: null,
    };
  }
}
