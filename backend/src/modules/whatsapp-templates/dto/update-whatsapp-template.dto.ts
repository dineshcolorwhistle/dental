import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { WhatsAppTemplateStatus } from './create-whatsapp-template.dto';

export class UpdateWhatsAppTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  triggerEvent?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsEnum(WhatsAppTemplateStatus)
  @IsOptional()
  status?: WhatsAppTemplateStatus;

  @IsArray()
  @IsOptional()
  placeholders?: string[];
}
