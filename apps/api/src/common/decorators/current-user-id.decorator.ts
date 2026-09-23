import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Request } from 'express';

/**
 * Temporary stand-in for real authentication: reads the caller's user id
 * from an `X-User-Id` header instead of a verified JWT. Every consumer of
 * this decorator will keep working unchanged once the Auth step replaces
 * the implementation below with `req.user.id` from a Passport JWT guard.
 */
export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const userId = request.header('x-user-id');

  if (!userId || !isUUID(userId)) {
    throw new UnauthorizedException('Missing or invalid X-User-Id header');
  }

  return userId;
});
