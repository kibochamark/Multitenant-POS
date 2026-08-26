import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CheckoutCartDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  stationId: string;

  // Optional for anonymous cash/M-Pesa sales, required later if CREDIT is used.
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsIn(['PAY_NOW', 'CREDIT'])
  settlement?: 'PAY_NOW' | 'CREDIT';

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  creditNote?: string;
}
