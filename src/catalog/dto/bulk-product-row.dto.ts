import { IsDecimal, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const MONEY = /^\d+(\.\d{1,2})?$/;

export class BulkProductRowDto {
  @IsString() @MinLength(2) @MaxLength(160) name: string;
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) @Matches(MONEY) price: string;
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) @Matches(MONEY) costPrice: string;
  @IsInt() @Min(1) quantityAtHand: number;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) minMarginPct?: number;
  @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) @Matches(MONEY) minPrice?: string;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}
