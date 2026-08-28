import { IsDecimal, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const POSITIVE_MONEY = /^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/;
export class CashCreditRepaymentDto {
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) @Matches(POSITIVE_MONEY) amount: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class MpesaCreditRepaymentDto extends CashCreditRepaymentDto {
  @IsString() @MinLength(5) @MaxLength(30) referenceCode: string;
}
export class VerifyCreditRepaymentDto {
  @IsIn(['CONFIRMED', 'FAILED']) result: 'CONFIRMED' | 'FAILED';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class CreditAdjustmentDto {
  @IsIn(['DISCOUNT', 'PARDON']) type: 'DISCOUNT' | 'PARDON';
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) @Matches(POSITIVE_MONEY) amount: string;
  @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
