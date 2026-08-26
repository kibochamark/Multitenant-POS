import { NotificationChannel } from 'generated/prisma/client';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateNotificationChannelDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  destination?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  accessToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^v\d+\.\d+$/)
  apiVersion?: string;
}

export class TestNotificationChannelDto {
  @IsOptional()
  @IsString()
  templateName = 'hello_world';

  @IsOptional()
  @IsString()
  languageCode = 'en_US';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bodyParameters?: string[];
}

export const supportedNotificationChannels = [
  NotificationChannel.IN_APP,
  NotificationChannel.WHATSAPP,
] as const;

export function isSupportedNotificationChannel(value: string) {
  return (supportedNotificationChannels as readonly string[]).includes(value);
}
