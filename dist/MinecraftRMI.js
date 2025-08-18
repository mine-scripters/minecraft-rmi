import { DimensionTypes, world, system } from '@minecraft/server';

const MINESCRIPTERS_NAMESPACE = 'minescripters';
const buildServerNamespace = (namespace) => `${MINESCRIPTERS_NAMESPACE}_${namespace}`;
const inputMessageEvent = (namespace) => `${buildServerNamespace(namespace)}:rmi.event-payload`;
const sendEvent = (event) => {
    DimensionTypes.getAll().some((dt) => {
        return world.getDimension(dt.typeId)?.runCommand(`scriptevent ${event}`).successCount;
    });
};

var SchemaEntryType;
(function (SchemaEntryType) {
    SchemaEntryType[SchemaEntryType["OBJECT"] = 0] = "OBJECT";
    SchemaEntryType[SchemaEntryType["NUMBER"] = 1] = "NUMBER";
    SchemaEntryType[SchemaEntryType["STRING"] = 2] = "STRING";
    SchemaEntryType[SchemaEntryType["ARRAY"] = 3] = "ARRAY";
    SchemaEntryType[SchemaEntryType["BOOL"] = 4] = "BOOL";
    SchemaEntryType[SchemaEntryType["ANY"] = 5] = "ANY";
})(SchemaEntryType || (SchemaEntryType = {}));
const validateBase = (schema, obj) => {
    if (!schema.isOptional) {
        if (obj === undefined) {
            throw new Error('Invalid schema, undefined but not optional');
        }
    }
    if (!schema.allowNull) {
        if (obj === null) {
            throw new Error('Invalid schema, null but does not allow null');
        }
    }
};
const validate = (schema, obj) => {
    schema = normalize(schema);
    if (Array.isArray(schema)) {
        let passed = false;
        for (const subSchema of schema) {
            try {
                validate(subSchema, obj);
                passed = true;
                break;
            }
            catch (e) {
                console.error(e);
            }
        }
        if (!passed) {
            throw new Error('Invalid schema');
        }
        return;
    }
    if (schema === SchemaEntryType.ANY) {
        return;
    }
    validateBase(schema, obj);
    if (obj === null || obj === undefined) {
        return;
    }
    if (schema.type === SchemaEntryType.NUMBER) {
        if (typeof obj !== 'number' && typeof obj !== 'bigint') {
            throw new Error('Invalid schema, not a number (or bigint)');
        }
    }
    else if (schema.type === SchemaEntryType.ARRAY) {
        if (!Array.isArray(obj)) {
            throw new Error('Invalid schema, not an array');
        }
        if (schema.items) {
            for (const entry of obj) {
                validate(schema.items, entry);
            }
        }
    }
    else if (schema.type === SchemaEntryType.STRING) {
        if (typeof obj !== 'string') {
            throw new Error('Invalid schema, not a string');
        }
    }
    else if (schema.type === SchemaEntryType.BOOL) {
        if (typeof obj !== 'boolean') {
            throw new Error('Invalid schema, not a bool');
        }
    }
    else if (schema.type === SchemaEntryType.OBJECT) {
        if (typeof obj !== 'object' || Array.isArray(obj)) {
            throw new Error('Invalid schema, not an object');
        }
        if (schema.entries) {
            for (const key of Object.keys(obj)) {
                if (key in schema.entries) {
                    validate(schema.entries[key], obj[key]);
                }
                else {
                    if (!schema.extraKeys) {
                        throw new Error('Invalid schema, invalid key: ' + key);
                    }
                    validate(schema.extraKeys, obj[key]);
                }
            }
        }
        else if (schema.extraKeys) {
            const extraKeys = schema.extraKeys;
            Object.values(obj).forEach((o) => validate(extraKeys, o));
        }
    }
};
const validateArray = (schemas, objs) => {
    objs = [...objs];
    while (schemas.length > objs.length) {
        objs.push(undefined);
    }
    for (let i = 0; i < schemas.length; i++) {
        validate(schemas[i], objs[i]);
    }
};
const normalize = (schema) => {
    if (schema === SchemaEntryType.NUMBER) {
        return {
            type: SchemaEntryType.NUMBER,
        };
    }
    else if (schema === SchemaEntryType.STRING) {
        return {
            type: SchemaEntryType.STRING,
        };
    }
    else if (schema === SchemaEntryType.OBJECT) {
        return {
            type: SchemaEntryType.OBJECT,
        };
    }
    else if (schema === SchemaEntryType.ARRAY) {
        return {
            type: SchemaEntryType.ARRAY,
        };
    }
    else if (schema === SchemaEntryType.BOOL) {
        return {
            type: SchemaEntryType.BOOL,
        };
    }
    return schema;
};

const makeId = () => {
    return Math.random().toString(36).substring(2);
};

const RMI_NAMESPACE = 'minescripters_rmi';
// Prevents the scriptevent parser from identifying it as a json object an failing to parse
const CHUNK_PADDING = '-';
const receiverScriptEvent = (id) => `${RMI_NAMESPACE}:${id}.receiver`;
const senderScriptEvent = (id) => `${RMI_NAMESPACE}:${id}.sender`;
const promiseResolver = () => {
    let resolver = () => { };
    return [
        new Promise((resolve) => {
            resolver = resolve;
        }),
        resolver,
    ];
};
const ackWaiter = async (scriptEvent) => {
    const [acked, ack] = promiseResolver();
    const namespace = scriptEvent.split(':')[0];
    const listener = system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id === scriptEvent) {
            ack();
        }
    }, {
        namespaces: [namespace],
    });
    await acked;
    system.afterEvents.scriptEventReceive.unsubscribe(listener);
};
const internalSendMessage = async (header, data, scriptevent, maxMessageSize = 2048) => {
    const id = makeId();
    const chunks = [];
    if (data !== undefined) {
        const dataString = JSON.stringify(data);
        for (let i = 0; i < maxMessageSize; i += maxMessageSize) {
            chunks.push(dataString.slice(i, i + maxMessageSize));
        }
    }
    const transportHeader = {
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
const internalMessageReceived = async (rawHeader) => {
    const header = JSON.parse(rawHeader);
    const id = header.id;
    if (!id) {
        console.error('Unknown data received:', header);
        throw new Error('Unknow data received');
    }
    const chunkCount = header.chunkCount;
    const chunks = [];
    let data = undefined;
    if (chunkCount && chunkCount > 0) {
        const [acked, ack] = promiseResolver();
        const listener = system.afterEvents.scriptEventReceive.subscribe((event) => {
            if (event.id === receiverScriptEvent(id)) {
                // Removes CHUNK_PADDING
                chunks.push(event.message.slice(1));
                if (chunks.length === chunkCount) {
                    ack();
                }
            }
        }, {
            namespaces: [RMI_NAMESPACE],
        });
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

const serverStopEvent = (server) => `${buildServerNamespace(server.namespace)}:rmi.event-stop`;
const serverReturnEvent = (namespace, message) => {
    const localNamespace = `${buildServerNamespace(namespace)}_${message.id}`;
    return `${localNamespace}:${message.endpoint}`;
};
const returnError = (server, payload, error) => {
    const message = {
        id: payload.id,
        endpoint: payload.endpoint,
        hasReturn: false,
        isError: true,
    };
    internalSendMessage(message, error, serverReturnEvent(server.namespace, message));
};
const returnValue = (server, payload, value) => {
    const message = {
        id: payload.id,
        endpoint: payload.endpoint,
        hasReturn: value !== undefined,
        isError: false,
    };
    internalSendMessage(message, value, serverReturnEvent(server.namespace, message));
};
const start = (server) => {
    const stopEvent = serverStopEvent(server);
    const payloadEvent = inputMessageEvent(server.namespace);
    const handler = system.afterEvents.scriptEventReceive.subscribe(async (event) => {
        if (event.id === stopEvent) {
            system.afterEvents.scriptEventReceive.unsubscribe(handler);
        }
        else if (event.id === payloadEvent) {
            const messageReceived = await internalMessageReceived(event.message);
            const payload = messageReceived.header;
            if (!(payload.endpoint in server.endpoints)) {
                returnError(server, payload, `Endpoint ${payload.endpoint} not found`);
                return;
            }
            const params = (messageReceived.data === undefined ? [] : messageReceived.data);
            const endpoint = server.endpoints[payload.endpoint];
            if (endpoint.schema?.arguments) {
                try {
                    validateArray(endpoint.schema.arguments, params);
                }
                catch (e) {
                    returnError(server, payload, `Failed schema validation for arguments: ${e}`);
                }
            }
            const response = await endpoint.handler(...params);
            if (endpoint.schema?.returnValue) {
                try {
                    validate(endpoint.schema.returnValue, response);
                }
                catch (e) {
                    returnError(server, payload, `Failed schema validation for return value: ${e}`);
                }
            }
            returnValue(server, payload, response);
        }
    }, {
        namespaces: [buildServerNamespace(server.namespace)],
    });
};
const startServer = (_server) => {
    if (_server.namespace.includes(':')) {
        throw new Error('`:` is not a legal character for a namespace in: ' + _server.namespace);
    }
    const server = {
        ..._server,
        endpoints: { ..._server.endpoints },
    };
    start(server);
};

const responseListener = (input) => {
    let handler;
    const promise = new Promise((resolve, reject) => {
        const cancelHandler = system.runTimeout(() => {
            reject(new Error(`Timeout: Timed out trying to run ${input.endpoint} of ${input.namespace}`));
        }, input.timeout);
        handler = system.afterEvents.scriptEventReceive.subscribe(async (event) => {
            if (event.id === input.eventKey) {
                try {
                    const response = await internalMessageReceived(event.message);
                    const returnMessage = response.header;
                    if (returnMessage.isError) {
                        reject(new Error(response.data));
                    }
                    else {
                        if (returnMessage.hasReturn) {
                            resolve(response.data);
                        }
                        else {
                            resolve(undefined);
                        }
                    }
                }
                catch (e) {
                    reject(e);
                }
                finally {
                    system.clearRun(cancelHandler);
                }
            }
        }, {
            namespaces: [input.localNamespace],
        });
    });
    const clean = () => {
        system.afterEvents.scriptEventReceive.unsubscribe(handler);
    };
    return [clean, promise];
};
const sendMessage = async (namespace, endpoint, args, timeout = 60) => {
    const messageId = makeId();
    const localNamespace = `${buildServerNamespace(namespace)}_${messageId}`;
    const eventKey = `${localNamespace}:${endpoint}`;
    const message = {
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
    }
    finally {
        clean();
    }
};

export { SchemaEntryType, sendMessage, startServer, validate, validateArray };
//# sourceMappingURL=MinecraftRMI.js.map
