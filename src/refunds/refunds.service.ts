import { Injectable, Logger } from '@nestjs/common';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundsRepository } from './refunds.repository';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);
  constructor(private readonly repository: RefundsRepository) {}
  create(shopId: string, orderId: string, userId: string, data: CreateRefundDto) {
    this.logger.log(`Preparing refund for order ${orderId}`);
    return this.repository.process(shopId, orderId, userId, data);
  }
}
