import { z } from 'zod';

/**
 * Single source of truth for environment configuration. Parsed once at boot;
 * a malformed environment fails fast with a readable error instead of surfacing
 * as undefined-at-runtime bugs deep in a request.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),

  // Optional at Milestone 1; required from their respective milestones onward.
  REDIS_URL: z.string().url().optional(),
  AI_SERVICE_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validation callback wired into `ConfigModule.forRoot`. Throwing here aborts
 * application startup, which is the desired behaviour for bad config.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
