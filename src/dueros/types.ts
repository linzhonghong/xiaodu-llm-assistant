export type DuerOsSlot = {
  name?: string;
  value?: string;
};

export type DuerOsIntent = {
  name?: string;
  slots?: Record<string, DuerOsSlot | undefined>;
};

export type DuerOsRequestEnvelope = {
  version?: string;
  session?: {
    new?: boolean;
    sessionId?: string;
    application?: {
      applicationId?: string;
    };
    user?: {
      userId?: string;
    };
    attributes?: Record<string, unknown>;
  };
  context?: {
    System?: {
      application?: {
        applicationId?: string;
      };
      user?: {
        userId?: string;
      };
      device?: {
        deviceId?: string;
      };
    };
  };
  request?: {
    type?: 'LaunchRequest' | 'IntentRequest' | 'SessionEndedRequest' | string;
    requestId?: string;
    timestamp?: string;
    intent?: DuerOsIntent;
    reason?: string;
  };
};

export type ParsedDuerOsRequest = {
  requestType: string;
  intentName: string;
  slots: Record<string, DuerOsSlot | undefined>;
  query: string;
  sessionId: string;
  userId: string;
  deviceId: string;
  applicationId: string;
  userKey: string;
};

export type DuerOsResponse = {
  version: '2.0';
  session: {
    attributes: Record<string, unknown>;
  };
  response: {
    outputSpeech?: {
      type: 'PlainText';
      text: string;
    };
    reprompt?: {
      outputSpeech: {
        type: 'PlainText';
        text: string;
      };
    };
    shouldEndSession: boolean;
  };
};
