import { IsDecimal, IsOptional, Matches } from 'class-validator';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class AccountsRangeQueryDto {
  @IsOptional()
  @Matches(datePattern)
  from?: string;

  @IsOptional()
  @Matches(datePattern)
  to?: string;
}

export class SetOpeningCashDto {
  @Matches(datePattern)
  businessDate!: string;

  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(/^\d+(?:\.\d{1,2})?$/, { message: 'openingCash must be zero or greater with at most 2 decimal places' })
  openingCash!: string;
}
