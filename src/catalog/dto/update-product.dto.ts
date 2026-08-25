import {
  IsBoolean,
  IsDecimal,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsInt,
} from 'class-validator';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) barcode?: string;
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN)
  price?: string;
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN)
  costPrice?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minMarginPct?: number;
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN)
  minPrice?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}
