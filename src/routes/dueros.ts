import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import type { AppDatabase } from '../memory/db.js';
import { createConversationStore } from '../memory/conversation.js';
import { parseDuerOsRequest } from '../dueros/parser.js';
import { endedResponse, speechResponse } from '../dueros/response.js';
import { isExitIntent, isHelpIntent } from '../dueros/intents.js';
import { createDuerOsSignatureVerifier, DuerOsAuthError } from '../dueros/auth.js';
import { createLlmClient } from '../llm/client.js';
import { systemPrompt } from '../llm/prompt.js';
import { normalizeForTts } from '../llm/normalizer.js';
import { createHomeAssistantClient } from '../ha/client.js';
import { executeHaIntent, executePendingConfirmation, parseHomeAssistantIntent } from '../ha/intent.js';
import { isConfirmationQuery, isRejectionQuery } from '../safety/confirm.js';
import { getErrorMessage } from '../utils/errors.js';

export async function registerDuerOsRoute(app: FastifyInstance, config: AppConfig, db: AppDatabase) {
  const conversation = createConversationStore(db, config.MAX_HISTORY_MESSAGES);
  const llm = createLlmClient(config);
  const ha = createHomeAssistantClient(config);
  const duerosSignature = createDuerOsSignatureVerifier();

  app.post('/dueros', async (request, reply) => {
    const body = request.body as never;
    if (config.DUEROS_VERIFY_SIGNATURE) {
      try {
        await duerosSignature.verify(request.headers, request.rawBody ?? '', body);
      } catch (error) {
        if (error instanceof DuerOsAuthError) {
          request.log.warn({ error: error.message }, 'DuerOS signature verification failed');
          return reply.status(401).send({ error: 'Invalid DuerOS signature' });
        }
        throw error;
      }
    }

    const parsed = parseDuerOsRequest(body);

    if (parsed.requestType === 'LaunchRequest') {
      return speechResponse('我在，想问什么？', false);
    }

    if (parsed.requestType === 'SessionEndedRequest') {
      return endedResponse();
    }

    if (parsed.requestType !== 'IntentRequest') {
      return speechResponse('我没有听清楚，请再说一遍。', false);
    }

    if (isExitIntent(parsed.intentName, parsed.query)) {
      return speechResponse('好的，再见。', true);
    }

    if (isHelpIntent(parsed.intentName, parsed.query)) {
      return speechResponse('你可以问我问题，也可以让我查询或控制家里的设备。', false);
    }

    if (!parsed.query) {
      return speechResponse('我没有听清楚，请再说一遍。', false);
    }

    if (config.HA_ENABLED) {
      try {
        conversation.deleteExpiredPendingConfirmations();
        const pending = conversation.getPendingConfirmation(parsed.userKey);
        if (pending && isConfirmationQuery(parsed.query)) {
          conversation.clearPendingConfirmation(pending.id);
          return speechResponse(await executePendingConfirmation(ha, pending), false);
        }
        if (pending && isRejectionQuery(parsed.query)) {
          conversation.clearPendingConfirmation(pending.id);
          return speechResponse('好的，已取消。', false);
        }

        const haIntent = parseHomeAssistantIntent(parsed.query);
        if (haIntent?.kind === 'high_risk') {
          conversation.createPendingConfirmation(parsed.userKey, parsed.sessionId, 'high_risk_control', { query: parsed.query });
          return speechResponse('这个设备比较敏感，请确认是否继续？', false);
        }
        if (haIntent) {
          return speechResponse(await executeHaIntent(ha, haIntent), false);
        }
      } catch (error) {
        request.log.error({ error: getErrorMessage(error) }, 'Home Assistant handling failed');
        return speechResponse('家里设备暂时连接不上，稍后再试一下。', false);
      }
    }

    try {
      const history = conversation.getHistory(parsed.userKey);
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history,
        { role: 'user' as const, content: parsed.query }
      ];
      conversation.addMessage(parsed.userKey, parsed.sessionId, 'user', parsed.query);
      const rawReply = await llm.chat(messages);
      const reply = normalizeForTts(rawReply, config.MAX_REPLY_CHARS);
      conversation.addMessage(parsed.userKey, parsed.sessionId, 'assistant', reply);
      return speechResponse(reply, false);
    } catch (error) {
      request.log.error({ error: getErrorMessage(error) }, 'LLM handling failed');
      return speechResponse('我这边暂时有点忙，稍后再试一下。', false);
    }
  });
}
