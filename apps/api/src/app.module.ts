import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ChecksModule } from './checks/checks.module.js';
import { HealthModule } from './health/health.module.js';
import { MonitorsModule } from './monitors/monitors.module.js';
import { PingerModule } from './pinger/pinger.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    MonitorsModule,
    ChecksModule,
    PingerModule,
  ],
})
export class AppModule {}
