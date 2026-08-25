import {
  IsDecimal,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN, {
    message:
      'price must be a non-negative monetary value with at most 2 decimal places',
  })
  price: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
