import type { HomeAssistantClient } from './client.js';
import { findEntity } from './entities.js';
import { isHighRiskControl } from '../safety/guard.js';
import type { PendingConfirmation } from '../memory/conversation.js';

export type HaIntent =
  | {
      kind: 'control';
      entityName: string;
      entityId: string;
      domain: 'light' | 'climate';
      service: 'turn_on' | 'turn_off';
    }
  | {
      kind: 'query';
      entityName: string;
      entityId: string;
    }
  | {
      kind: 'high_risk';
      query: string;
    };

export function parseHomeAssistantIntent(query: string): HaIntent | undefined {
  if (isHighRiskControl(query)) {
    return { kind: 'high_risk', query };
  }

  const entity = findEntity(query);
  if (!entity) {
    return undefined;
  }

  if (/(状态|怎么样|开着吗|关着吗|是否|有没有)/.test(query)) {
    return {
      kind: 'query',
      entityName: entity.name,
      entityId: entity.entityId
    };
  }

  if (/(打开|开启|启动)/.test(query)) {
    return {
      kind: 'control',
      entityName: entity.name,
      entityId: entity.entityId,
      domain: entity.domain,
      service: 'turn_on'
    };
  }

  if (/(关闭|关掉|停止)/.test(query)) {
    return {
      kind: 'control',
      entityName: entity.name,
      entityId: entity.entityId,
      domain: entity.domain,
      service: 'turn_off'
    };
  }

  return undefined;
}

export async function executeHaIntent(client: HomeAssistantClient, intent: Exclude<HaIntent, { kind: 'high_risk' }>): Promise<string> {
  if (intent.kind === 'query') {
    const state = await client.getState(intent.entityId);
    const stateText = state.state === 'on' ? '开着' : state.state === 'off' ? '关着' : state.state;
    return `${intent.entityName}现在是${stateText}。`;
  }

  await client.callService(intent.domain, intent.service, intent.entityId);
  return intent.service === 'turn_on' ? `已打开${intent.entityName}。` : `已关闭${intent.entityName}。`;
}

export async function executePendingConfirmation(_client: HomeAssistantClient, pending: PendingConfirmation): Promise<string> {
  if (pending.actionType === 'high_risk_control') {
    return '为了安全，这类设备暂不支持语音直接控制。';
  }
  return '这个确认请求已经无法处理，请重新说一遍。';
}
