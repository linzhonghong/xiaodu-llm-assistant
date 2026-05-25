import { includesAny } from '../utils/text.js';

const exitPhrases = ['退出', '不用了', '结束', '拜拜', '再见'];
const helpIntentNames = new Set(['HelpIntent', 'AMAZON.HelpIntent', 'ai.dueros.common.help_intent']);
const exitIntentNames = new Set(['CancelIntent', 'StopIntent', 'AMAZON.CancelIntent', 'AMAZON.StopIntent', 'ai.dueros.common.cancel_intent']);

export function isExitIntent(intentName: string, query: string): boolean {
  return exitIntentNames.has(intentName) || includesAny(query, exitPhrases);
}

export function isHelpIntent(intentName: string, query: string): boolean {
  return helpIntentNames.has(intentName) || query === '帮助' || query === '怎么用';
}
