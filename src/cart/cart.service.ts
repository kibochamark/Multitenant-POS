import { Injectable, Logger } from '@nestjs/common';
import { CartRepository } from './cart.repository';
import { ActiveCartQueryDto, ScanBarcodeDto } from './dto/scan-barcode.dto';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { ApplyCartDiscountDto } from './dto/apply-cart-discount.dto';
import { DiscountType, Prisma } from 'generated/prisma/client';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  constructor(private readonly repository: CartRepository) {}

  scanProduct(shopId: string, staffId: string, data: ScanBarcodeDto) {
    this.logger.log(`Preparing barcode scan for shop ${shopId}`);
    return this.repository.scanProduct(
      shopId,
      staffId,
      data.stationId.trim(),
      data.barcode.trim(),
    );
  }

  getActiveCart(shopId: string, staffId: string, query: ActiveCartQueryDto) {
    this.logger.log(`Preparing active cart lookup for shop ${shopId}`);
    return this.repository.getActiveCart(
      shopId,
      staffId,
      query.stationId.trim(),
    );
  }

  abandon(
    shopId: string,
    cartId: string,
    staffId: string,
    data: ActiveCartQueryDto,
  ) {
    this.logger.log(`Preparing manual cart abandonment for shop ${shopId}`);
    return this.repository.abandon(
      shopId,
      cartId,
      staffId,
      data.stationId.trim(),
    );
  }

  applyDiscount(
    shopId: string,
    cartId: string,
    cartItemId: string,
    staffId: string,
    data: ApplyCartDiscountDto,
  ) {
    this.logger.log(`Preparing cart-item discount for shop ${shopId}`);
    return this.repository.applyDiscount(
      shopId,
      cartId,
      cartItemId,
      staffId,
      data.stationId.trim(),
      data.type as DiscountType,
      new Prisma.Decimal(data.value),
      data.reason,
    );
  }

  checkout(
    shopId: string,
    cartId: string,
    staffId: string,
    data: CheckoutCartDto,
  ) {
    this.logger.log(`Preparing cart checkout for shop ${shopId}`);
    return this.repository.checkout(
      shopId,
      cartId,
      staffId,
      data.stationId.trim(),
      data.customerId,
    );
  }
}
