import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { AccountSeederService } from './account-seeder.service';
import { AccountingController } from './accounting.controller';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountingRepository } from './accounting.repository';
import { AccountingService } from './accounting.service';

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, AccountingRepository, AccountSeederService, AccountingPostingService, AuthGuard, ShopAccessGuard],
  exports: [AccountSeederService, AccountingPostingService],
})
export class AccountingModule {}
