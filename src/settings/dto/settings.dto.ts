import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

export class UpdateNotificationPreferenceDto {
  @IsBoolean() enabled: boolean;
  @IsBoolean() inAppEnabled: boolean;
  @IsBoolean() whatsappEnabled: boolean;
  @IsBoolean() smsEnabled: boolean;
  @IsOptional() @IsBoolean() optIn?: boolean;
}

export class UpdateCompanySettingsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) vatPct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) defaultMinMarginPct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) globalDiscountPct?: number;
}

export class UpdateShopSettingsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  vatPct?: number | null;
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(1000)
  defaultMinMarginPct?: number | null;
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  globalDiscountPct?: number | null;
}
