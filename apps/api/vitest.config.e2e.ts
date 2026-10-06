import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Any spec that boots AppModule also starts PingerService's real
    // background interval. dotenv (loaded via ConfigModule) won't override
    // an already-set process.env var, so this keeps it from firing
    // mid-test in specs that don't expect it (pinger.e2e-spec.ts drives
    // PingerService.tick() directly and doesn't depend on the interval).
    env: {
      PINGER_TICK_MS: '3600000',
    },
  },
});
