import type { DuerOsResponse } from './types.js';

export function speechResponse(text: string, shouldEndSession = false, reprompt = '还需要我做什么？'): DuerOsResponse {
  return {
    version: '2.0',
    session: {
      attributes: {}
    },
    response: {
      outputSpeech: {
        type: 'PlainText',
        text
      },
      reprompt: {
        outputSpeech: {
          type: 'PlainText',
          text: reprompt
        }
      },
      expectSpeech: !shouldEndSession,
      shouldEndSession
    }
  };
}

export function endedResponse(): DuerOsResponse {
  return {
    version: '2.0',
    session: {
      attributes: {}
    },
    response: {
      expectSpeech: false,
      shouldEndSession: true
    }
  };
}
