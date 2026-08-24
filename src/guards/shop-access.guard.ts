import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import {
  AuthenticatedRequest,
  ShopRole,
} from 'src/types/authenticated-request.types';

export const SHOP_ACCESS_KEY = 'shop-access';

export interface ShopAccessOptions {
  shopIdParam: string;
  roles: ShopRole[];
}

@Injectable()
export class ShopAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<ShopAccessOptions>(
      SHOP_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      throw new ForbiddenException('Shop access metadata is missing');
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException();
    }

    const shopIdValue = request.params[options.shopIdParam];
    if (!shopIdValue || Array.isArray(shopIdValue)) {
      throw new ForbiddenException(
        `Shop route parameter '${options.shopIdParam}' is missing`,
      );
    }
    const shopId = shopIdValue;

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, companyId: true },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    // A default owner has every-shop access only inside their own company.
    if (shop.companyId !== request.user.companyId) {
      throw new ForbiddenException('You cannot access this shop');
    }

    if (request.user.defaultOwner) {
      request.shopAccess = { shopId, role: null, ownerBypass: true };
      return true;
    }

    const membership = await this.prisma.userShopRole.findUnique({
      where: {
        userId_shopId: {
          userId: request.user.id,
          shopId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not assigned to this shop');
    }

    if (
      options.roles.length > 0 &&
      !options.roles.includes(membership.role as ShopRole)
    ) {
      throw new ForbiddenException('Your shop role cannot perform this action');
    }

    request.shopAccess = {
      shopId,
      role: membership.role as ShopRole,
      ownerBypass: false,
    };

    return true;
  }
}
