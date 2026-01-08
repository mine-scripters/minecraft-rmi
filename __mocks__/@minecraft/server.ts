// import type * as MC from '@minecraft/server';

let currId = 0;
export const makeId = (): string => {
  return `${currId++}`;
};

let scriptEventReceive: Record<string, unknown> = {};

const scriptEventReceiveSubscribe = (handler: unknown) => {
  const id = makeId();
  scriptEventReceive[id] = handler;
  return id;
};

const scriptEventReceiveUnsubscribe = (handlerId: string) => {
  delete scriptEventReceive[handlerId];
};

export const system = {
  reset: () => {
    scriptEventReceive = {};
  },

  runTimeout: (handler: () => void, timeout: number) => {
    const key = setTimeout(handler, timeout);
    return key;
  },
  clearRun: (key: string) => {
    clearTimeout(key);
  },
  afterEvents: {
    scriptEventReceive: {
      subscribe: jest.fn(scriptEventReceiveSubscribe as any),
      unsubscribe: jest.fn(scriptEventReceiveUnsubscribe as any),
    },
  },
  sendScriptEvent: jest.fn((event: string, message: string) => {
    if (message.length > 2048) {
      throw new Error('Message longer than 2048 sent in tests: ' + message);
    }
    for (const handler of Object.values(scriptEventReceive)) {
      // console.log('sending to handler');
      (handler as any)({
        id: event,
        message: message,
      });
    }
  }),
};
