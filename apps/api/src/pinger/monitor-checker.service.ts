import { Injectable } from '@nestjs/common';

export interface CheckResult {
  status: 'UP' | 'DOWN';
  statusCode?: number;
  responseTimeMs: number;
  error?: string;
}

@Injectable()
export class MonitorCheckerService {
  async check(url: string, timeoutMs: number): Promise<CheckResult> {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      const responseTimeMs = Math.round(performance.now() - startedAt);

      // 2xx/3xx counts as up: redirects (e.g. http -> https) are normal,
      // expected behaviour for a lot of real-world services, not a failure.
      const isUp = response.status < 400;

      return {
        status: isUp ? 'UP' : 'DOWN',
        statusCode: response.status,
        responseTimeMs,
        error: isUp ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      const responseTimeMs = Math.round(performance.now() - startedAt);
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? `Timed out after ${timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      return { status: 'DOWN', responseTimeMs, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
