import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
} from 'class-validator';

export enum WhatsAppTemplateStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateWhatsAppTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  triggerEvent?: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(WhatsAppTemplateStatus)
  @IsOptional()
  status?: WhatsAppTemplateStatus;

  @IsArray()
  @IsOptional()
  placeholders?: string[];
}
