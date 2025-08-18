import { system } from '@minecraft/server';
import { buildServerNamespace, InputMessage, OutputMessage, inputMessageEvent } from './Communication';
import { makeId } from './Utils';
import { internalMessageReceived, internalSendMessage } from './Transport';

interface ResponseListenerInput {
  timeout: number;
  endpoint: string;
  namespace: string;
  localNamespace: string;
  eventKey: string;
}

const responseListener = (input: ResponseListenerInput): [() => void, Promise<unknown>] => {
  let handler: ReturnType<typeof system.afterEvents.scriptEventReceive.subscribe>;
  const promise = new Promise<unknown>((resolve, reject) => {
    const cancelHandler = system.runTimeout(() => {
      reject(new Error(`Timeout: Timed out trying to run ${input.endpoint} of ${input.namespace}`));
    }, input.timeout);

    handler = system.afterEvents.scriptEventReceive.subscribe(
      async (event) => {
        if (event.id === input.eventKey) {
          try {
            const response = await internalMessageReceived(event.message);
            const returnMessage: OutputMessage = response.header as OutputMessage;
            if (returnMessage.isError) {
              reject(new Error(response.data as string));
            } else {
              if (returnMessage.hasReturn) {
                resolve(response.data);
              } else {
                resolve(undefined);
              }
            }
          } catch (e) {
            reject(e);
          } finally {
            system.clearRun(cancelHandler);
          }
        }
      },
      {
        namespaces: [input.localNamespace],
      }
    );
  });

  const clean = () => {
    system.afterEvents.scriptEventReceive.unsubscribe(handler);
  };

  return [clean, promise];
};

export const sendMessage = async (
  namespace: string,
  endpoint: string,
  args: Array<unknown> | undefined,
  timeout: number = 60
): Promise<unknown> => {
  const messageId = makeId();
  const localNamespace = `${buildServerNamespace(namespace)}_${messageId}`;
  const eventKey = `${localNamespace}:${endpoint}`;

  const message: InputMessage = {
    id: messageId,
    endpoint: endpoint,
    timeout,
  };

  const [clean, promise] = responseListener({
    endpoint,
    eventKey,
    localNamespace,
    namespace,
    timeout,
  });

  try {
    internalSendMessage(message, args, inputMessageEvent(namespace));

    return await promise;
  } finally {
    clean();
  }
};
