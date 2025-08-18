import { system } from '@minecraft/server';
import { buildServerNamespace, sendEvent, InputMessage, OutputMessage, inputMessageEvent } from './Communication';
import { SchemaEntry, validate, validateArray } from './Schema';
import { internalMessageReceived, internalSendMessage } from './Transport';

export interface Server {
  namespace: string;
  endpoints: Record<string, Endpoint>;
}

export interface Endpoint {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...params: Array<any>) => unknown;
  schema?: EndpointSchema;
}

export type EndpointSchema = {
  arguments?: Array<SchemaEntry>;
  returnValue?: SchemaEntry;
};

const serverStopEvent = (server: Server) => `${buildServerNamespace(server.namespace)}:rmi.event-stop`;
const serverReturnEvent = (namespace: string, message: OutputMessage) => {
  const localNamespace = `${buildServerNamespace(namespace)}_${message.id}`;
  return `${localNamespace}:${message.endpoint}`;
};

const returnError = (server: Server, payload: InputMessage, error: string) => {
  const message: OutputMessage = {
    id: payload.id,
    endpoint: payload.endpoint,
    hasReturn: false,
    isError: true,
  };

  internalSendMessage(message, error, serverReturnEvent(server.namespace, message));
};

const returnValue = (server: Server, payload: InputMessage, value: unknown) => {
  const message: OutputMessage = {
    id: payload.id,
    endpoint: payload.endpoint,
    hasReturn: value !== undefined,
    isError: false,
  };

  internalSendMessage(message, value, serverReturnEvent(server.namespace, message));
};

const start = (server: Server) => {
  const stopEvent = serverStopEvent(server);
  const payloadEvent = inputMessageEvent(server.namespace);
  const handler = system.afterEvents.scriptEventReceive.subscribe(
    async (event) => {
      if (event.id === stopEvent) {
        system.afterEvents.scriptEventReceive.unsubscribe(handler);
      } else if (event.id === payloadEvent) {
        const messageReceived = await internalMessageReceived(event.message);
        const payload = messageReceived.header as InputMessage;

        if (!(payload.endpoint in server.endpoints)) {
          returnError(server, payload, `Endpoint ${payload.endpoint} not found`);
          return;
        }

        const params = (messageReceived.data === undefined ? [] : messageReceived.data) as Array<unknown>;

        const endpoint = server.endpoints[payload.endpoint];
        if (endpoint.schema?.arguments) {
          try {
            validateArray(endpoint.schema.arguments, params);
          } catch (e) {
            returnError(server, payload, `Failed schema validation for arguments: ${e}`);
          }
        }

        const response = await endpoint.handler(...params);

        if (endpoint.schema?.returnValue) {
          try {
            validate(endpoint.schema.returnValue, response);
          } catch (e) {
            returnError(server, payload, `Failed schema validation for return value: ${e}`);
          }
        }

        returnValue(server, payload, response);
      }
    },
    {
      namespaces: [buildServerNamespace(server.namespace)],
    }
  );
};

export const stopServer = (server: Server) => {
  sendEvent(serverStopEvent(server));
};

export const startServer = (_server: Server) => {
  if (_server.namespace.includes(':')) {
    throw new Error('`:` is not a legal character for a namespace in: ' + _server.namespace);
  }

  const server = {
    ..._server,
    endpoints: { ..._server.endpoints },
  };

  start(server);
};
