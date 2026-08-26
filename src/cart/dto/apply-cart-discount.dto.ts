import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ApplyCartDiscountDto {
  @IsString() @MinLength(1) @MaxLength(100) stationId: string;
  @IsIn(['PERCENT', 'FLAT']) type: 'PERCENT' | 'FLAT';
  @IsString()
  @Matches(/^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/, {
    message: 'value must be greater than zero with at most 2 decimal places',
  })
  value: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
