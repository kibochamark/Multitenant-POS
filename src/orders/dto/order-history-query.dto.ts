import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderHistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number =
    25;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(['NORMAL', 'CREDIT', 'MIXED']) saleType?:
    'NORMAL' | 'CREDIT' | 'MIXED';
  @IsOptional() @IsIn(['OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']) status?:
    'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
