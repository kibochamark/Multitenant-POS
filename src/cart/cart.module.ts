import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { CartController } from './cart.controller';
import { CartRepository } from './cart.repository';
import { CartService } from './cart.service';

@Module({
  controllers: [CartController],
  providers: [CartService, CartRepository, AuthGuard, ShopAccessGuard],
})
export class CartModule {}
