import type { AppConfig } from '../config.js';

export type HomeAssistantClient = {
  getState(entityId: string): Promise<{ state: string; attributes?: Record<string, unknown> }>;
  callService(domain: string, service: string, entityId: string): Promise<void>;
};

export function createHomeAssistantClient(config: AppConfig): HomeAssistantClient {
  const baseUrl = config.HA_BASE_URL.replace(/\/$/, '');

  async function request(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.HA_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${config.HA_TOKEN}`,
          'content-type': 'application/json',
          ...init.headers
        }
      });
      if (!response.ok) {
        throw new Error(`Home Assistant request failed with ${response.status}`);
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async getState(entityId: string) {
      const response = await request(`/api/states/${entityId}`);
      return (await response.json()) as { state: string; attributes?: Record<string, unknown> };
    },

    async callService(domain: string, service: string, entityId: string) {
      await request(`/api/services/${domain}/${service}`, {
        method: 'POST',
        body: JSON.stringify({
          entity_id: entityId
        })
      });
    }
  };
}
