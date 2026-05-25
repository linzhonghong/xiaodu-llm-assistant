import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PUBLIC_BASE_URL: z.string().url().default('https://xiaodu.example.com'),
  LLM_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  LLM_API_KEY: z.string().min(1).default(''),
  LLM_MODEL: z.string().min(1).default('gpt-4.1-mini'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DB_PATH: z.string().min(1).default('./data/app.db'),
  MAX_HISTORY_MESSAGES: z.coerce.number().int().positive().default(12),
  MAX_REPLY_CHARS: z.coerce.number().int().positive().default(120),
  DUEROS_VERIFY_SIGNATURE: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() === 'true'),
  HA_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value.toLowerCase() === 'true'),
  HA_BASE_URL: z.string().url().default('http://192.168.1.10:8123'),
  HA_TOKEN: z.string().default(''),
  HA_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  LOG_LEVEL: z.string().default('info')
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
