import type { DuerOsRequestEnvelope, ParsedDuerOsRequest } from './types.js';

function slotValue(slots: Record<string, { value?: string } | undefined>, name: string): string {
  return slots[name]?.value?.trim() ?? '';
}

function queryText(body: DuerOsRequestEnvelope): string {
  return (body.request?.query?.rewritten ?? body.request?.query?.original ?? '').trim();
}

export function extractQuery(slots: Record<string, { value?: string } | undefined>): string {
  const preferred = [slotValue(slots, 'query'), slotValue(slots, 'text'), slotValue(slots, 'content')].find(Boolean);
  if (preferred) {
    return preferred;
  }

  return Object.values(slots)
    .map((slot) => slot?.value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .trim();
}

export function parseDuerOsRequest(body: DuerOsRequestEnvelope): ParsedDuerOsRequest {
  const requestType = body.request?.type ?? '';
  const intent = body.request?.intent ?? body.request?.intents?.[0];
  const slots = intent?.slots ?? {};
  const applicationId = body.session?.application?.applicationId ?? body.context?.System?.application?.applicationId ?? 'unknown-app';
  const userId = body.session?.user?.userId ?? body.context?.System?.user?.userId ?? 'anonymous-user';
  const deviceId = body.context?.System?.device?.deviceId ?? 'unknown-device';
  const sessionId = body.session?.sessionId ?? 'unknown-session';
  const query = extractQuery(slots) || queryText(body);

  return {
    requestType,
    intentName: intent?.name ?? '',
    slots,
    query,
    sessionId,
    userId,
    deviceId,
    applicationId,
    userKey: `${applicationId}:${userId}:${deviceId}`
  };
}
