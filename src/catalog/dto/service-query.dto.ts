import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class ServiceListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsIn(['true', 'false']) active?: 'true' | 'false';
}

export class ServiceSearchQueryDto {
  @IsString() @MinLength(1) q: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
}
