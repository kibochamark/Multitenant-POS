import { IsIn, IsOptional, IsUUID, Matches, MaxLength } from 'class-validator';

const date = /^\d{4}-\d{2}-\d{2}$/;

export class SurplusRangeDto {
  @IsOptional() @Matches(date) from?: string;
  @IsOptional() @Matches(date) to?: string;
}

export class SettleSurplusDto {
  @IsUUID() cashierId!: string;
  @Matches(date) from!: string;
  @Matches(date) to!: string;
  @IsIn(['CASH', 'MPESA']) paymentMethod!: 'CASH' | 'MPESA';
  @IsOptional() @MaxLength(100) mpesaReference?: string;
}
