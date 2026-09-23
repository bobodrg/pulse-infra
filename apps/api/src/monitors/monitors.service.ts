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
