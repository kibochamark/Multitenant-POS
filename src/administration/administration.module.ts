import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { AdministrationController } from './administration.controller';
import { AdministrationRepository } from './administration.repository';
import { AdministrationService } from './administration.service';

@Module({ controllers: [AdministrationController], providers: [AdministrationService, AdministrationRepository, AuthGuard, ShopAccessGuard] })
export class AdministrationModule {}
