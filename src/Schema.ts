export enum SchemaEntryType {
  OBJECT,
  NUMBER,
  STRING,
  ARRAY,
  BOOL,
  ANY,
}

interface SchemaEntryBase {
  isOptional?: boolean;
  allowNull?: boolean;
}

export interface SchemaEntryNumber extends SchemaEntryBase {
  type: SchemaEntryType.NUMBER;
}

export interface SchemaEntryString extends SchemaEntryBase {
  type: SchemaEntryType.STRING;
}

export interface SchemaEntryObject extends SchemaEntryBase {
  type: SchemaEntryType.OBJECT;
  extraKeys?: SchemaEntry;
  entries?: {
    [key: string]: SchemaEntry;
  };
}

export interface SchemaEntryBool extends SchemaEntryBase {
  type: SchemaEntryType.BOOL;
}

export interface SchemaEntryArray extends SchemaEntryBase {
  type: SchemaEntryType.ARRAY;
  items?: SchemaEntry;
}

export type SchemaEntry =
  | SchemaEntryNumber
  | SchemaEntryString
  | SchemaEntryBool
  | SchemaEntryObject
  | SchemaEntryArray
  | SchemaEntryType
  | Array<SchemaEntry>;

type InternalSchema =
  | SchemaEntryNumber
  | SchemaEntryString
  | SchemaEntryBool
  | SchemaEntryObject
  | SchemaEntryArray
  | SchemaEntryType.ANY
  | Array<SchemaEntry>;

const validateBase = (schema: SchemaEntryBase, obj: unknown) => {
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

export const validate = (schema: SchemaEntry, obj: unknown) => {
  schema = normalize(schema);

  if (Array.isArray(schema)) {
    let passed = false;
    for (const subSchema of schema) {
      try {
        validate(subSchema, obj);
        passed = true;
        break;
      } catch (e) {
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
  } else if (schema.type === SchemaEntryType.ARRAY) {
    if (!Array.isArray(obj)) {
      throw new Error('Invalid schema, not an array');
    }

    if (schema.items) {
      for (const entry of obj) {
        validate(schema.items, entry);
      }
    }
  } else if (schema.type === SchemaEntryType.STRING) {
    if (typeof obj !== 'string') {
      throw new Error('Invalid schema, not a string');
    }
  } else if (schema.type === SchemaEntryType.BOOL) {
    if (typeof obj !== 'boolean') {
      throw new Error('Invalid schema, not a bool');
    }
  } else if (schema.type === SchemaEntryType.OBJECT) {
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Invalid schema, not an object');
    }

    if (schema.entries) {
      for (const key of Object.keys(obj)) {
        if (key in schema.entries) {
          validate(schema.entries[key], (obj as { [key]: unknown })[key]);
        } else {
          if (!schema.extraKeys) {
            throw new Error('Invalid schema, invalid key: ' + key);
          }

          validate(schema.extraKeys, (obj as { [key]: unknown })[key]);
        }
      }
    } else if (schema.extraKeys) {
      const extraKeys = schema.extraKeys;
      Object.values(obj).forEach((o) => validate(extraKeys, o));
    }
  }
};

export const validateArray = (schemas: Array<SchemaEntry>, objs: Array<unknown>) => {
  objs = [...objs];
  while (schemas.length > objs.length) {
    objs.push(undefined);
  }

  for (let i = 0; i < schemas.length; i++) {
    validate(schemas[i], objs[i]);
  }
};

const normalize = (schema: SchemaEntry): InternalSchema => {
  if (schema === SchemaEntryType.NUMBER) {
    return {
      type: SchemaEntryType.NUMBER,
    };
  } else if (schema === SchemaEntryType.STRING) {
    return {
      type: SchemaEntryType.STRING,
    };
  } else if (schema === SchemaEntryType.OBJECT) {
    return {
      type: SchemaEntryType.OBJECT,
    };
  } else if (schema === SchemaEntryType.ARRAY) {
    return {
      type: SchemaEntryType.ARRAY,
    };
  } else if (schema === SchemaEntryType.BOOL) {
    return {
      type: SchemaEntryType.BOOL,
    };
  }

  return schema;
};
