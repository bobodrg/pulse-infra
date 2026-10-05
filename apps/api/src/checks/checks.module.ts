import { Module } from '@nestjs/common';
import { MonitorsModule } from '../monitors/monitors.module.js';
import { ChecksController } from './checks.controller.js';
import { ChecksService } from './checks.service.js';

@Module({
  imports: [MonitorsModule],
  controllers: [ChecksController],
  providers: [ChecksService],
})
export class ChecksModule {}
