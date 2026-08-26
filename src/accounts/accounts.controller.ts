import { Body, Controller, Get, Logger, Param, Put, Query, Req, Version } from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { AccountsService } from './accounts.service';
import { AccountsRangeQueryDto, SetOpeningCashDto } from './dto/accounts.dto';

@Controller('shops/:shopId/accounts')
export class AccountsController {
  private readonly logger = new Logger(AccountsController.name);
  constructor(private readonly service: AccountsService) {}

  @Get() @Version('1') @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async list(@Param('shopId') shopId: string, @Query() query: AccountsRangeQueryDto) {
    return { status: 200, data: await this.service.list(shopId, query), error: null };
  }

  @Put('opening-cash') @Version('1') @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async openingCash(@Param('shopId') shopId: string, @Req() request: AuthenticatedRequest, @Body() data: SetOpeningCashDto) {
    this.logger.log(`Opening cash update requested for shop ${shopId}`);
    return { status: 200, data: await this.service.setOpeningCash(shopId, request.user!.id, data), error: null };
  }
}
