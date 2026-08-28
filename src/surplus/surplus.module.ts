import { Module } from '@nestjs/common';
import { AccountingModule } from 'src/accounting/accounting.module';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { SurplusController } from './surplus.controller';
import { SurplusRepository } from './surplus.repository';
import { SurplusService } from './surplus.service';

@Module({ imports: [AccountingModule], controllers: [SurplusController], providers: [SurplusService, SurplusRepository, AuthGuard, ShopAccessGuard] })
export class SurplusModule {}
