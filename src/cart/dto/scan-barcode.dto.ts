import { IsString, MaxLength, MinLength } from 'class-validator';

export class ScanBarcodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  barcode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  stationId: string;
}

export class ActiveCartQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  stationId: string;
}
