import { Injectable, Logger } from '@nestjs/common';
import { CartRepository } from './cart.repository';
import { ActiveCartQueryDto, ScanBarcodeDto } from './dto/scan-barcode.dto';

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
}
