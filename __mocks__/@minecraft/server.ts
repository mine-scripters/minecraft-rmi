// import type * as MC from '@minecraft/server';

let currId = 0;
export const makeId = (): string => {
  return `${currId++}`;
};

let scriptEventReceive: Record<string, unknown> = {};
let worldProps: Record<string, unknown> = {};
let systemTimeout: Record<string, unknown> = {};

const scriptEventReceiveSubscribe = (handler: unknown) => {
  const id = makeId();
  scriptEventReceive[id] = handler;
  return id;
};

const scriptEventReceiveUnsubscribe = (handlerId: string) => {
  delete scriptEventReceive[handlerId];
};

const setDynamicProperty = (key: string, value?: unknown) => {
  worldProps[key] = value;
};

const getDynamicProperty = (key: string) => {
  return worldProps[key];
};

export const system = {
  reset: () => {
    scriptEventReceive = {};
    worldProps = {};
    systemTimeout = {};
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
};

export const DimensionTypes = {
  getAll: () => {
    return ['minecraft:overworld'];
  },
};

export const dimension = {
  runCommand: jest.fn((command: string) => {
    if (!command.startsWith('scriptevent ')) {
      return {
        successCount: 0,
      };
    }

    command = command.substring('scriptevent '.length);
    const [id, ...pieces] = command.split(' ');

    for (const handler of Object.values(scriptEventReceive)) {
      (handler as any)({
        id: id,
        message: pieces.join(' '),
      });
    }

    return {
      successCount: 1,
    };
  }),
};

export const world = {
  getDynamicProperty,
  setDynamicProperty,
  getDimension: () => {
    return dimension;
  },
};
