import { system } from '@minecraft/server';
import { makeId } from './Utils';
import { sendEvent } from './Communication';

interface TransportHeader {
  id: string;
  chunkCount?: number;
  header: unknown;
}

export interface Received {
  header: unknown;
  data?: unknown;
}

const RMI_NAMESPACE = 'minescripters_rmi';
// Prevents the scriptevent parser from identifying it as a json object an failing to parse
const CHUNK_PADDING = '-';

const receiverScriptEvent = (id: string) => `${RMI_NAMESPACE}:${id}.receiver`;
const senderScriptEvent = (id: string) => `${RMI_NAMESPACE}:${id}.sender`;

const promiseResolver = (): [Promise<void>, () => void] => {
  let resolver: () => void = () => {};
  return [
    new Promise((resolve) => {
      resolver = resolve;
    }),
    resolver,
  ];
};

const ackWaiter = async (scriptEvent: string) => {
  const [acked, ack] = promiseResolver();

  const namespace = scriptEvent.split(':')[0];
  const listener = system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
      if (event.id === scriptEvent) {
        ack();
      }
    },
    {
      namespaces: [namespace],
    }
  );

  await acked;

  system.afterEvents.scriptEventReceive.unsubscribe(listener);
};

export const internalSendMessage = async (
  header: unknown,
  data: unknown,
  scriptevent: string,
  maxMessageSize = 2048
) => {
  const id = makeId();

  const chunks: Array<string> = [];

  if (data !== undefined) {
    const dataString = JSON.stringify(data);
    for (let i = 0; i < maxMessageSize; i += maxMessageSize) {
      chunks.push(dataString.slice(i, i + maxMessageSize));
    }
  }

  const transportHeader: TransportHeader = {
    id,
    header,
  };

  if (chunks.length > 0) {
    transportHeader.chunkCount = chunks.length;
  }

  const initialAck = ackWaiter(senderScriptEvent(id));
  const rawTransportHeader = JSON.stringify(transportHeader);
  if (rawTransportHeader.length > 2048) {
    console.error('Transport header is bigger than 2048 characters:', rawTransportHeader);
    throw new Error('Transport header is bigger than 2048');
  }

  sendEvent(`${scriptevent} ${rawTransportHeader}`);

  await initialAck;
  if (chunks.length > 0) {
    const chunksAck = ackWaiter(senderScriptEvent(id));

    for (const chunk of chunks) {
      sendEvent(`${receiverScriptEvent(id)} ${CHUNK_PADDING}${chunk}`);
    }

    await chunksAck;
  }
};

export const internalMessageReceived = async (rawHeader: string): Promise<Received> => {
  const header = JSON.parse(rawHeader) as Partial<TransportHeader>;
  const id = header.id;

  if (!id) {
    console.error('Unknown data received:', header);
    throw new Error('Unknow data received');
  }

  const chunkCount = header.chunkCount;
  const chunks: Array<string> = [];
  let data = undefined;

  if (chunkCount && chunkCount > 0) {
    const [acked, ack] = promiseResolver();

    const listener = system.afterEvents.scriptEventReceive.subscribe(
      (event) => {
        if (event.id === receiverScriptEvent(id)) {
          // Removes CHUNK_PADDING
          chunks.push(event.message.slice(1));

          if (chunks.length === chunkCount) {
            ack();
          }
        }
      },
      {
        namespaces: [RMI_NAMESPACE],
      }
    );

    sendEvent(`${senderScriptEvent(id)}`);

    await acked;
    system.afterEvents.scriptEventReceive.unsubscribe(listener);

    const rawData = chunks.join('');

    data = JSON.parse(rawData);
    sendEvent(`${senderScriptEvent(id)}`);
  }

  return {
    header: header.header,
    data,
  };
};
