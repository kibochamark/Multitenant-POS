import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { CompanyRepo } from './company.repository';

@Module({
  providers: [CompanyService, CompanyRepo, AuthGuard, ShopAccessGuard],
  controllers: [CompanyController],
})
export class CompanyModule {}
