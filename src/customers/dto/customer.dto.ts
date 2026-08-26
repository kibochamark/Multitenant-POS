import { Type } from 'class-transformer';
import {
  IsDecimal,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateCustomerDto {
  @IsString() @MinLength(2) @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsEmail()
  @MaxLength(200)
  email?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class CustomerListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() cursor?: string;
}

export class CustomerSearchQueryDto {
  @IsString() @MinLength(1) @MaxLength(160) q: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
}

export class ChangeCreditLimitDto {
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @Matches(MONEY_PATTERN)
  newLimit: string;

  @IsString() @MinLength(2) @MaxLength(500) reason: string;
}
