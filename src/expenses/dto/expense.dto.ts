import {
  IsDecimal,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(/^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/, {
    message: 'amount must be greater than zero with at most 2 decimal places',
  })
  amount: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  category: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description: string;
}

export class ExpenseListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
