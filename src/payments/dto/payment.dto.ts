import { IsDateString, IsDecimal, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const MONEY_PATTERN = /^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/;

export class AmountDto {
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN, { message: 'amount must be greater than zero with at most 2 decimal places' })
  amount: string;
}

export class ManualMpesaPaymentDto extends AmountDto {
  @IsString() @MinLength(5) @MaxLength(30) referenceCode: string;
}

export class CreditPaymentDto extends AmountDto {
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class VerifyMpesaPaymentDto {
  @IsIn(['CONFIRMED', 'FAILED']) result: 'CONFIRMED' | 'FAILED';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
