import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from 'generated/prisma/client';
import { SettleSurplusDto, SurplusRangeDto } from './dto/surplus.dto';
import { SurplusRepository } from './surplus.repository';

@Injectable()
export class SurplusService {
  private readonly logger = new Logger(SurplusService.name);
  constructor(private readonly repository: SurplusRepository) {}
  async report(shopId: string, query: SurplusRangeDto, cashierId?: string) { return await this.repository.report(shopId, query.from, query.to, cashierId); }
  async settle(shopId: string, paidById: string, data: SettleSurplusDto) { this.logger.log(`Preparing surplus settlement in shop ${shopId}`); return await this.repository.settle(shopId, paidById, { ...data, paymentMethod: data.paymentMethod as PaymentMethod }); }
}
