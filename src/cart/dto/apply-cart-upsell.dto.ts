import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ApplyCartUpsellDto {
  @IsString() @MinLength(1) @MaxLength(100) stationId!: string;

  @IsString()
  @Matches(/^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/, {
    message: 'negotiatedUnitPrice must be greater than zero with at most 2 decimal places',
  })
  negotiatedUnitPrice!: string;

  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
