import { DimensionTypes, system, world } from '@minecraft/server';

interface Message {
  id: string;
  endpoint: string;
}

export interface InputMessage extends Message {
  hasArguments: boolean;
  timeout: number;
}

export interface OutputMessage extends Message {
  hasValue: boolean;
  isError: boolean;
}

const MINESCRIPTERS_NAMESPACE = 'minescripters';

export const buildServerNamespace = (namespace: string) => `${MINESCRIPTERS_NAMESPACE}_${namespace}`;

export const inputMessageEvent = (namespace: string) => `${buildServerNamespace(namespace)}:rmi.event-payload`;

export const sendEvent = (event: string) => {
  DimensionTypes.getAll().some((dt) => {
    return world.getDimension(dt.typeId)?.runCommand(`scriptevent ${event}`).successCount;
  });
};

export const argsKey = (namespace: string, message: Message) =>
  `${buildServerNamespace(namespace)}:rmi.payload.${message.endpoint}.${message.id}.args`;
export const returnValueKey = (namespace: string, message: Message) =>
  `${buildServerNamespace(namespace)}:rmi.payload.${message.endpoint}.${message.id}.return`;

export const setDynamicPropertyAndExpire = (key: string, value: unknown, timeout: number) => {
  world.setDynamicProperty(key, JSON.stringify(value));
  system.runTimeout(() => {
    world.setDynamicProperty(key);
  }, timeout);
};
