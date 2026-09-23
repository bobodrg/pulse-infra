import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateMonitorDto } from './create-monitor.dto.js';

export class UpdateMonitorDto extends PartialType(CreateMonitorDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
