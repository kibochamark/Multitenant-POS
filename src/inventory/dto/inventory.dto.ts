import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';

export class RestockProductDto {
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class WriteOffProductDto {
  @IsInt() @Min(1) quantity: number;
  @IsString() @MinLength(2) @MaxLength(160) reason: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class AdjustStockDto {
  @IsInt() @NotEquals(0) quantityDelta: number;
  @IsString() @MinLength(2) @MaxLength(160) reason: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class MovementQueryDto {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
