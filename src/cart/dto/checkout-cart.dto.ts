import {
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
}
