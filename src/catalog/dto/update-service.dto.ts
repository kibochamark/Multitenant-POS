import {
  IsBoolean,
  IsDecimal,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN)
  price?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
