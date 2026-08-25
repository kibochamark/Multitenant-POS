import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsIn(['true', 'false']) active?: 'true' | 'false';
}

export class ProductSearchQueryDto {
  @IsString() @MinLength(1) q: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
}

export class LowStockQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
}
