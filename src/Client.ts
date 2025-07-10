import { system, world } from '@minecraft/server';
import {
  buildServerNamespace,
  sendEvent,
  argsKey,
  InputMessage,
  OutputMessage,
  returnValueKey,
  inputMessageEvent,
  setDynamicPropertyAndExpire,
} from './Communication';
import { makeId } from './Utils';

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
      (event) => {
        if (event.id === input.eventKey) {
          try {
            const returnMessage: OutputMessage = JSON.parse(event.message);
            if (returnMessage.isError) {
              const errorString = world.getDynamicProperty(returnValueKey(input.namespace, returnMessage)) as string;
              reject(new Error(errorString));
            } else {
              if (returnMessage.hasValue) {
                const returnValue = world.getDynamicProperty(returnValueKey(input.namespace, returnMessage)) as string;
                world.setDynamicProperty(returnValueKey(input.namespace, returnMessage));
                resolve(JSON.parse(returnValue));
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
    hasArguments: args !== undefined && args.length > 0,
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
    if (message.hasArguments) {
      const argumentsKey = argsKey(namespace, message);
      setDynamicPropertyAndExpire(argumentsKey, args, timeout);
    }

    sendEvent(`${inputMessageEvent(namespace)} ${JSON.stringify(message)}`);
    return await promise;
  } finally {
    clean();
  }
};
