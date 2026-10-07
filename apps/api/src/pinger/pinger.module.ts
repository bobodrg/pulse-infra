import { Module } from '@nestjs/common';
import { MonitorsModule } from '../monitors/monitors.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { MonitorCheckerService } from './monitor-checker.service.js';
import { PingerService } from './pinger.service.js';

@Module({
  imports: [MonitorsModule, NotificationsModule],
  providers: [PingerService, MonitorCheckerService],
})
export class PingerModule {}
