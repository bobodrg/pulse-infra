import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChecksModule } from './checks/checks.module.js';
import { HealthModule } from './health/health.module.js';
import { MonitorsModule } from './monitors/monitors.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    HealthModule,
    MonitorsModule,
    ChecksModule,
  ],
})
export class AppModule {}
