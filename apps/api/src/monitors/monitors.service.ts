import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMonitorDto } from './dto/create-monitor.dto.js';
import { UpdateMonitorDto } from './dto/update-monitor.dto.js';

@Injectable()
export class MonitorsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateMonitorDto) {
    return this.prisma.monitor.create({
      data: {
        userId,
        name: dto.name,
        url: dto.url,
        intervalSeconds: dto.intervalSeconds,
        notifyEmail: dto.notifyEmail,
        notifyWebhookUrl: dto.notifyWebhookUrl,
      },
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.monitor.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * System-level query for the background pinger — unscoped by user, unlike
   * every other method here. Filtering "due" (lastCheckedAt + intervalSeconds
   * <= now) happens in application code rather than SQL: intervalSeconds
   * varies per row, and at this project's scale (a handful of monitors) a
   * full table scan plus in-memory filter is simpler than a correlated
   * subquery and costs nothing measurable.
   */
  async findDueForCheck(now: Date) {
    const activeMonitors = await this.prisma.monitor.findMany({ where: { isActive: true } });

    return activeMonitors.filter((monitor) => {
      if (!monitor.lastCheckedAt) {
        return true;
      }

      const dueAt = monitor.lastCheckedAt.getTime() + monitor.intervalSeconds * 1000;
      return now.getTime() >= dueAt;
    });
  }

  markChecked(id: string, checkedAt: Date) {
    return this.prisma.monitor.update({ where: { id }, data: { lastCheckedAt: checkedAt } });
  }

  async findOneForUser(userId: string, id: string) {
    const monitor = await this.prisma.monitor.findFirst({ where: { id, userId } });

    if (!monitor) {
      throw new NotFoundException(`Monitor ${id} not found`);
    }

    return monitor;
  }

  async update(userId: string, id: string, dto: UpdateMonitorDto) {
    await this.findOneForUser(userId, id);

    return this.prisma.monitor.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOneForUser(userId, id);

    await this.prisma.monitor.delete({ where: { id } });
  }
}
