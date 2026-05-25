import type { AppConfig } from '../config.js';
import type { ChatMessage } from '../memory/conversation.js';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export type LlmClient = {
  chat(messages: ChatMessage[]): Promise<string>;
};

export function createLlmClient(config: AppConfig): LlmClient {
  return {
    async chat(messages: ChatMessage[]): Promise<string> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

      try {
        const response = await fetch(`${config.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${config.LLM_API_KEY}`
          },
          body: JSON.stringify({
            model: config.LLM_MODEL,
            messages,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          throw new Error(`LLM request failed with ${response.status}`);
        }

        const data = (await response.json()) as ChatCompletionResponse;
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) {
          throw new Error('LLM response did not contain content');
        }
        return content;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
