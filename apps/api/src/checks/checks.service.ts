import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MonitorsService } from '../monitors/monitors.service.js';
import { ListChecksQueryDto } from './dto/list-checks-query.dto.js';

@Injectable()
export class ChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitorsService: MonitorsService,
  ) {}

  async findForMonitor(userId: string, monitorId: string, query: ListChecksQueryDto) {
    // Confirms the monitor exists and belongs to the caller (throws 404 otherwise).
    await this.monitorsService.findOneForUser(userId, monitorId);

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.check.findMany({
        where: { monitorId },
        orderBy: { checkedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.check.count({ where: { monitorId } }),
    ]);

    return { items, total, limit, offset };
  }
}
