import { NotificationChannel } from 'generated/prisma/client';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateNotificationTemplateDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsEnum(NotificationChannel) channel!: NotificationChannel;
  @IsString() @MinLength(1) @MaxLength(1000) message!: string;
  @IsOptional() @IsString() @MaxLength(100) providerTemplateName?: string;
  @IsOptional() @IsString() @MaxLength(20) languageCode?: string;
}

export class ScheduleNotificationTemplateDto {
  @IsDateString() scheduledFor!: string;
  @IsOptional() @IsUUID() shopId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) bodyParameters?: string[];
}
