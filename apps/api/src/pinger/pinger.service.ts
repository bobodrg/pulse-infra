import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MonitorsService } from '../monitors/monitors.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MonitorCheckerService } from './monitor-checker.service.js';

const TICK_NAME = 'pinger-tick';

@Injectable()
export class PingerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PingerService.name);
  private readonly timeoutMs: number;
  private readonly tickMs: number;
  private ticking = false;

  constructor(
    private readonly monitorsService: MonitorsService,
    private readonly monitorChecker: MonitorCheckerService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    config: ConfigService,
  ) {
    this.timeoutMs = config.get<number>('CHECK_TIMEOUT_MS', 10_000);
    this.tickMs = config.get<number>('PINGER_TICK_MS', 5_000);
  }

  onModuleInit(): void {
    // Registered dynamically (rather than via @Interval(...)) so the tick
    // interval can come from ConfigService/.env: decorator arguments are
    // evaluated at class-definition time, before ConfigModule has loaded
    // the .env file, so a literal env read there would always fall back to
    // the hardcoded default.
    const interval = setInterval(() => void this.tick(), this.tickMs);
    this.schedulerRegistry.addInterval(TICK_NAME, interval);
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', TICK_NAME)) {
      this.schedulerRegistry.deleteInterval(TICK_NAME);
    }
  }

  async tick(): Promise<void> {
    // Guards against overlap: if a slow batch of checks is still running
    // when the next tick fires, skip it rather than pile up concurrent ticks.
    if (this.ticking) {
      return;
    }
    this.ticking = true;

    try {
      const due = await this.monitorsService.findDueForCheck(new Date());
      await Promise.allSettled(due.map((monitor) => this.checkOne(monitor)));
    } catch (error) {
      this.logger.error('Failed to run pinger tick', error);
    } finally {
      this.ticking = false;
    }
  }

  private async checkOne(monitor: {
    id: string;
    url: string;
    name: string;
    userId: string;
    notifyEmail: boolean;
    notifyWebhookUrl: string | null;
  }): Promise<void> {
    const previousCheck = await this.prisma.check.findFirst({
      where: { monitorId: monitor.id },
      orderBy: { checkedAt: 'desc' },
    });

    const checkedAt = new Date();
    const result = await this.monitorChecker.check(monitor.url, this.timeoutMs);

    const check = await this.prisma.check.create({
      data: {
        monitorId: monitor.id,
        status: result.status,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        error: result.error,
        checkedAt,
      },
    });
    await this.monitorsService.markChecked(monitor.id, checkedAt);

    if (result.status === 'DOWN') {
      this.logger.warn(`Monitor ${monitor.id} (${monitor.url}) is DOWN: ${result.error}`);
    }

    await this.notificationsService.notifyIfNewFailure(
      monitor,
      previousCheck?.status ?? null,
      check,
    );
  }
}
