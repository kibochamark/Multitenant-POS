import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { AccountsController } from './accounts.controller';
import { AccountsRepository } from './accounts.repository';
import { AccountsService } from './accounts.service';

@Module({ controllers: [AccountsController], providers: [AccountsService, AccountsRepository, AuthGuard, ShopAccessGuard] })
export class AccountsModule {}
