import type { AppConfig } from './config.js';

export function createLogger(config: Pick<AppConfig, 'LOG_LEVEL' | 'NODE_ENV'>) {
  if (config.NODE_ENV === 'test') {
    return false;
  }

  return {
    level: config.LOG_LEVEL
  };
}
