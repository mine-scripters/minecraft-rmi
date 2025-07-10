import { world, system, DimensionTypes } from '@minecraft/server';

const MINESCRIPTERS_NAMESPACE = 'minescripters';
const buildServerNamespace = (namespace) => `${MINESCRIPTERS_NAMESPACE}_${namespace}`;
const inputMessageEvent = (namespace) => `${buildServerNamespace(namespace)}:rmi.event-payload`;
const sendEvent = (event) => {
    DimensionTypes.getAll().some((dt) => {
        return world.getDimension(dt.typeId)?.runCommand(`scriptevent ${event}`).successCount;
    });
};
const argsKey = (namespace, message) => `${buildServerNamespace(namespace)}:rmi.payload.${message.endpoint}.${message.id}.args`;
const returnValueKey = (namespace, message) => `${buildServerNamespace(namespace)}:rmi.payload.${message.endpoint}.${message.id}.return`;
const setDynamicPropertyAndExpire = (key, value, timeout) => {
    world.setDynamicProperty(key, JSON.stringify(value));
    system.runTimeout(() => {
        world.setDynamicProperty(key);
    }, timeout);
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

const serverStopEvent = (server) => `${buildServerNamespace(server.namespace)}:rmi.event-stop`;
const serverReturnEvent = (namespace, message) => {
    const localNamespace = `${buildServerNamespace(namespace)}_${message.id}`;
    return `${localNamespace}:${message.endpoint}`;
};
const returnError = (server, payload, error) => {
    const message = {
        id: payload.id,
        endpoint: payload.endpoint,
        hasValue: false,
        isError: true,
    };
    const key = returnValueKey(server.namespace, message);
    setDynamicPropertyAndExpire(key, error, payload.timeout);
    sendEvent(`${serverReturnEvent(server.namespace, message)} ${JSON.stringify(message)}`);
};
const returnValue = (server, payload, value) => {
    const message = {
        id: payload.id,
        endpoint: payload.endpoint,
        hasValue: value !== undefined,
        isError: false,
    };
    if (value !== undefined) {
        const key = returnValueKey(server.namespace, message);
        setDynamicPropertyAndExpire(key, value, payload.timeout);
    }
    sendEvent(`${serverReturnEvent(server.namespace, message)} ${JSON.stringify(message)}`);
};
const getParams = (namespace, payload) => {
    if (payload.hasArguments) {
        return JSON.parse(world.getDynamicProperty(argsKey(namespace, payload)));
    }
    return [];
};
const start = (server) => {
    const stopEvent = serverStopEvent(server);
    const payloadEvent = inputMessageEvent(server.namespace);
    const handler = system.afterEvents.scriptEventReceive.subscribe(async (event) => {
        if (event.id === stopEvent) {
            system.afterEvents.scriptEventReceive.unsubscribe(handler);
        }
        else if (event.id === payloadEvent) {
            const payload = JSON.parse(event.message);
            // validate payload
            if (!(payload.endpoint in server.endpoints)) {
                returnError(server, payload, `Endpoint ${payload.endpoint} not found`);
                return;
            }
            const params = getParams(server.namespace, payload);
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

const makeId = () => {
    return Math.random().toString(36).substring(2);
};

const responseListener = (input) => {
    let handler;
    const promise = new Promise((resolve, reject) => {
        const cancelHandler = system.runTimeout(() => {
            reject(new Error(`Timeout: Timed out trying to run ${input.endpoint} of ${input.namespace}`));
        }, input.timeout);
        handler = system.afterEvents.scriptEventReceive.subscribe((event) => {
            if (event.id === input.eventKey) {
                try {
                    const returnMessage = JSON.parse(event.message);
                    if (returnMessage.isError) {
                        const errorString = world.getDynamicProperty(returnValueKey(input.namespace, returnMessage));
                        reject(new Error(errorString));
                    }
                    else {
                        if (returnMessage.hasValue) {
                            const returnValue = world.getDynamicProperty(returnValueKey(input.namespace, returnMessage));
                            world.setDynamicProperty(returnValueKey(input.namespace, returnMessage));
                            resolve(JSON.parse(returnValue));
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
    }
    finally {
        clean();
    }
};

export { SchemaEntryType, sendMessage, startServer, validate, validateArray };
//# sourceMappingURL=MinecraftRMI.js.map
