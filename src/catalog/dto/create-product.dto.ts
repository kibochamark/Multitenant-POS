import {
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

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  barcode: string;

  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN, {
    message:
      'price must be a non-negative monetary value with at most 2 decimal places',
  })
  price: string;

  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN, {
    message:
      'costPrice must be a non-negative monetary value with at most 2 decimal places',
  })
  costPrice: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minMarginPct?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN, {
    message:
      'minPrice must be a non-negative monetary value with at most 2 decimal places',
  })
  minPrice?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
