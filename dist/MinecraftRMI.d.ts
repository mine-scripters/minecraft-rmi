declare enum SchemaEntryType {
    OBJECT = 0,
    NUMBER = 1,
    STRING = 2,
    ARRAY = 3,
    BOOL = 4,
    ANY = 5
}
interface SchemaEntryBase {
    isOptional?: boolean;
    allowNull?: boolean;
}
interface SchemaEntryNumber extends SchemaEntryBase {
    type: SchemaEntryType.NUMBER;
}
interface SchemaEntryString extends SchemaEntryBase {
    type: SchemaEntryType.STRING;
}
interface SchemaEntryObject extends SchemaEntryBase {
    type: SchemaEntryType.OBJECT;
    extraKeys?: SchemaEntry;
    entries?: {
        [key: string]: SchemaEntry;
    };
}
interface SchemaEntryBool extends SchemaEntryBase {
    type: SchemaEntryType.BOOL;
}
interface SchemaEntryArray extends SchemaEntryBase {
    type: SchemaEntryType.ARRAY;
    items?: SchemaEntry;
}
type SchemaEntry = SchemaEntryNumber | SchemaEntryString | SchemaEntryBool | SchemaEntryObject | SchemaEntryArray | SchemaEntryType | Array<SchemaEntry>;
declare const validate: (schema: SchemaEntry, obj: unknown) => void;
declare const validateArray: (schemas: Array<SchemaEntry>, objs: Array<unknown>) => void;
interface Server {
    namespace: string;
    endpoints: Record<string, Endpoint>;
}
interface Endpoint {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (...params: Array<any>) => unknown;
    schema?: EndpointSchema;
}
type EndpointSchema = {
    arguments?: Array<SchemaEntry>;
    returnValue?: SchemaEntry;
};
declare const startServer: (_server: Server) => void;
declare const sendMessage: (namespace: string, endpoint: string, args: Array<unknown> | undefined, timeout?: number) => Promise<unknown>;
export { sendMessage, startServer, Server, SchemaEntry, SchemaEntryArray, SchemaEntryBool, SchemaEntryNumber, SchemaEntryObject, SchemaEntryString, SchemaEntryType, validate, validateArray };
