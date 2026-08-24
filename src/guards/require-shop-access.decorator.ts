import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ShopRole } from 'src/types/authenticated-request.types';
import { AuthGuard } from './auth.guard';
import {
  SHOP_ACCESS_KEY,
  ShopAccessGuard,
  ShopAccessOptions,
} from './shop-access.guard';

export function RequireShopAccess(shopIdParam: string, ...roles: ShopRole[]) {
  const options: ShopAccessOptions = { shopIdParam, roles };

  return applyDecorators(
    SetMetadata(SHOP_ACCESS_KEY, options),
    UseGuards(AuthGuard, ShopAccessGuard),
  );
}
