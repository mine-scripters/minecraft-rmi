import { DimensionTypes, world } from '@minecraft/server';

interface Message {
  id: string;
  endpoint: string;
}

export interface InputMessage extends Message {
  timeout: number;
}

export interface OutputMessage extends Message {
  isError: boolean;
  hasReturn: boolean;
}

const MINESCRIPTERS_NAMESPACE = 'minescripters';

export const buildServerNamespace = (namespace: string) => `${MINESCRIPTERS_NAMESPACE}_${namespace}`;

export const inputMessageEvent = (namespace: string) => `${buildServerNamespace(namespace)}:rmi.event-payload`;

export const sendEvent = (event: string) => {
  DimensionTypes.getAll().some((dt) => {
    return world.getDimension(dt.typeId)?.runCommand(`scriptevent ${event}`).successCount;
  });
};
