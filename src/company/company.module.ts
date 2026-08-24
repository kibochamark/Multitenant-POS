import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { CompanyRepo } from './company.repository';

@Module({
  providers: [CompanyService, CompanyRepo],
  controllers: [CompanyController]

})
export class CompanyModule {}
