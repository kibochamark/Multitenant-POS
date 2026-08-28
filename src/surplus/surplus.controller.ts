import { Body, Controller, Get, Param, Post, Query, Req, Version } from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { SettleSurplusDto, SurplusRangeDto } from './dto/surplus.dto';
import { SurplusService } from './surplus.service';

@Controller('shops/:shopId/surplus')
export class SurplusController {
  constructor(private readonly service: SurplusService) {}
  @Get() @Version('1') @RequireShopAccess('shopId', 'OWNER')
  async report(@Param('shopId') shopId: string, @Query() query: SurplusRangeDto) { return { status: 200, data: await this.service.report(shopId, query), error: null }; }
  @Get('me') @Version('1') @RequireShopAccess('shopId')
  async mine(@Param('shopId') shopId: string, @Req() request: AuthenticatedRequest, @Query() query: SurplusRangeDto) { return { status: 200, data: await this.service.report(shopId, query, request.user!.id), error: null }; }
  @Post('settlements') @Version('1') @RequireShopAccess('shopId', 'OWNER')
  async settle(@Param('shopId') shopId: string, @Req() request: AuthenticatedRequest, @Body() data: SettleSurplusDto) { return { status: 201, data: await this.service.settle(shopId, request.user!.id, data), error: null }; }
}
