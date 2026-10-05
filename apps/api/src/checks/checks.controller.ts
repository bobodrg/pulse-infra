import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { ChecksService } from './checks.service.js';
import { ListChecksQueryDto } from './dto/list-checks-query.dto.js';

@Controller('monitors/:monitorId/checks')
export class ChecksController {
  constructor(private readonly checksService: ChecksService) {}

  @Get()
  findAll(
    @CurrentUserId() userId: string,
    @Param('monitorId', ParseUUIDPipe) monitorId: string,
    @Query() query: ListChecksQueryDto,
  ) {
    return this.checksService.findForMonitor(userId, monitorId, query);
  }
}
