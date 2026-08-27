import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { RefundsController } from './refunds.controller';
import { RefundsRepository } from './refunds.repository';
import { RefundsService } from './refunds.service';
import { AccountingModule } from 'src/accounting/accounting.module';

@Module({ imports: [AccountingModule], controllers: [RefundsController], providers: [RefundsService, RefundsRepository, AuthGuard, ShopAccessGuard] })
export class RefundsModule {}
