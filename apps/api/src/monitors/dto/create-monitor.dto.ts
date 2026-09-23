import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMonitorDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(86400)
  intervalSeconds?: number;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  notifyWebhookUrl?: string;
}
