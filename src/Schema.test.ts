import { SchemaEntry, SchemaEntryType, validate, validateArray } from './Schema';

describe('Schema', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Validate base', () => {
    expect(() =>
      validate(
        {
          type: SchemaEntryType.NUMBER,
          allowNull: true,
        },
        5
      )
    ).not.toThrow();
    expect(() =>
      validate(
        {
          type: SchemaEntryType.NUMBER,
          isOptional: true,
        },
        5
      )
    ).not.toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.NUMBER,
          allowNull: true,
        },
        null
      )
    ).not.toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.NUMBER,
          isOptional: true,
        },
        undefined
      )
    ).not.toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.NUMBER,
        },
        undefined
      )
    ).toThrow();
    expect(() =>
      validate(
        {
          type: SchemaEntryType.NUMBER,
        },
        null
      )
    ).toThrow();
  });

  it('Validate array', () => {
    expect(() => validateArray([SchemaEntryType.STRING, SchemaEntryType.NUMBER], ['foo', 1])).not.toThrow();

    expect(() => validateArray([SchemaEntryType.STRING, SchemaEntryType.NUMBER], ['foo', '1'])).toThrow();
    expect(() =>
      validateArray([SchemaEntryType.STRING, SchemaEntryType.NUMBER], ['foo', 1, 'extra', 'params', 'are', 'ok'])
    ).not.toThrow();

    // Missing arguments that are optional is OK
    expect(() =>
      validateArray(
        [SchemaEntryType.STRING, SchemaEntryType.NUMBER, { type: SchemaEntryType.NUMBER, isOptional: true }],
        ['foo', 1]
      )
    ).not.toThrow();
    expect(() =>
      validateArray(
        [SchemaEntryType.STRING, SchemaEntryType.NUMBER, { type: SchemaEntryType.NUMBER, isOptional: true }],
        ['foo', 1, undefined]
      )
    ).not.toThrow();
  });

  it('validate number', () => {
    expect(() => validate(SchemaEntryType.NUMBER, 4)).not.toThrow();
    expect(() => validate(SchemaEntryType.NUMBER, 3.5)).not.toThrow();
    expect(() => validate(SchemaEntryType.NUMBER, 1444n)).not.toThrow();
    expect(() => validate(SchemaEntryType.NUMBER, 'foo')).toThrow();
    expect(() => validate(SchemaEntryType.NUMBER, '5')).toThrow();
    expect(() => validate(SchemaEntryType.NUMBER, [1, 2])).toThrow();
    expect(() =>
      validate(SchemaEntryType.NUMBER, {
        a: 1,
        b: 2,
      })
    ).toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.NUMBER,
        },
        5
      )
    ).not.toThrow();
  });

  it('validate bool', () => {
    expect(() => validate(SchemaEntryType.BOOL, true)).not.toThrow();
    expect(() => validate(SchemaEntryType.BOOL, false)).not.toThrow();
    expect(() => validate(SchemaEntryType.BOOL, 'foo')).toThrow();
    expect(() => validate(SchemaEntryType.BOOL, 1)).toThrow();
    expect(() => validate(SchemaEntryType.BOOL, 0)).toThrow();
    expect(() => validate(SchemaEntryType.BOOL, 'false')).toThrow();
    expect(() => validate(SchemaEntryType.BOOL, [1, 2])).toThrow();
    expect(() =>
      validate(SchemaEntryType.BOOL, {
        a: 1,
        b: 2,
      })
    ).toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.BOOL,
        },
        true
      )
    ).not.toThrow();
  });

  it('validate strings', () => {
    expect(() => validate(SchemaEntryType.STRING, 'hello')).not.toThrow();
    expect(() => validate(SchemaEntryType.STRING, '5')).not.toThrow();
    expect(() => validate(SchemaEntryType.STRING, 5)).toThrow();
    expect(() => validate(SchemaEntryType.STRING, [1, 2])).toThrow();
    expect(() =>
      validate(SchemaEntryType.STRING, {
        a: 1,
        b: 2,
      })
    ).toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.STRING,
        },
        'hello!'
      )
    ).not.toThrow();
  });

  it('validate any', () => {
    expect(() => validate(SchemaEntryType.ANY, 'hello')).not.toThrow();
    expect(() => validate(SchemaEntryType.ANY, '5')).not.toThrow();
    expect(() => validate(SchemaEntryType.ANY, 5)).not.toThrow();
    expect(() => validate(SchemaEntryType.ANY, [1, 2])).not.toThrow();
    expect(() =>
      validate(SchemaEntryType.ANY, {
        a: 1,
        b: 2,
      })
    ).not.toThrow();
    expect(() => validate(SchemaEntryType.ANY, undefined)).not.toThrow();
    expect(() => validate(SchemaEntryType.ANY, null)).not.toThrow();
  });

  it('validate array', () => {
    expect(() => validate(SchemaEntryType.ARRAY, [1, '2', {}, []])).not.toThrow();
    expect(() =>
      validate(SchemaEntryType.ARRAY, {
        a: 1,
        b: 2,
      })
    ).toThrow();
    expect(() => validate(SchemaEntryType.ARRAY, undefined)).toThrow();
    expect(() => validate(SchemaEntryType.ARRAY, null)).toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.ARRAY,
          items: SchemaEntryType.NUMBER,
        },
        [1, 2, 3]
      )
    ).not.toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.ARRAY,
          items: SchemaEntryType.NUMBER,
        },
        [1, 2, '3']
      )
    ).toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.ARRAY,
          items: SchemaEntryType.NUMBER,
        },
        ['1', '2', '3']
      )
    ).toThrow();
  });

  it('validate object', () => {
    expect(() =>
      validate(SchemaEntryType.OBJECT, {
        a: 1,
        b: 2,
      })
    ).not.toThrow();
    expect(() => validate(SchemaEntryType.OBJECT, [1, '2', {}, []])).toThrow();
    expect(() => validate(SchemaEntryType.OBJECT, undefined)).toThrow();
    expect(() => validate(SchemaEntryType.OBJECT, null)).toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.OBJECT,
          entries: {
            a: SchemaEntryType.NUMBER,
            b: SchemaEntryType.NUMBER,
            c: SchemaEntryType.STRING,
          },
          extraKeys: SchemaEntryType.STRING,
        },
        {
          a: 5,
          b: 124,
          c: 'dd',
          d: 'foobar',
        }
      )
    ).not.toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.OBJECT,
        },
        {
          a: 5,
          b: 124,
          c: 'dd',
          d: 'foobar',
        }
      )
    ).not.toThrow();

    expect(() =>
      validate(
        {
          type: SchemaEntryType.OBJECT,
          extraKeys: SchemaEntryType.STRING,
        },
        {
          a: '5',
          b: '124',
          c: 'dd',
          d: 'foobar',
        }
      )
    ).not.toThrow();
  });

  it('one or other', () => {
    const schema: SchemaEntry = [
      SchemaEntryType.STRING,
      SchemaEntryType.BOOL, // string | boolean
    ];

    expect(() => validate(schema, 'hello world')).not.toThrow();
    expect(() => validate(schema, 'other string')).not.toThrow();
    expect(() => validate(schema, true)).not.toThrow();
    expect(() => validate(schema, false)).not.toThrow();

    const aggregateError = new AggregateError(
      ['Invalid schema, not a string', 'Invalid schema, not a bool'],
      'Invalid schema, none of the schemas matched'
    );

    expect(() => validate(schema, 1)).toThrow(aggregateError);
    expect(() => validate(schema, 1.5)).toThrow(aggregateError);
    expect(() => validate(schema, undefined)).toThrow(aggregateError);
    expect(() => validate(schema, null)).toThrow();
  });

  it('complex objects', () => {
    const schema: SchemaEntry = {
      type: SchemaEntryType.OBJECT,
      entries: {
        health: {
          type: SchemaEntryType.NUMBER,
          isOptional: true,
        },
        isAlive: {
          type: SchemaEntryType.BOOL,
        },
        items: {
          type: SchemaEntryType.ARRAY,
          items: [
            {
              type: SchemaEntryType.OBJECT,
              entries: {
                name: SchemaEntryType.STRING,
                damage: SchemaEntryType.NUMBER,
              },
            },
            {
              type: SchemaEntryType.OBJECT,
              entries: {
                name: SchemaEntryType.STRING,
                healing: SchemaEntryType.NUMBER,
              },
            },
          ],
        },
      },
    };

    expect(() =>
      validate(schema, {
        health: 200,
        isAlive: true,
        items: [
          {
            name: 'Sword of the thousand cries',
            damage: 100,
          },
          {
            name: 'Potion',
            healing: 200,
          },
        ],
      })
    ).not.toThrow();

    expect(() =>
      validate(schema, {
        health: 200,
        isAlive: true,
        items: [
          {
            name: 'Sword of the thousand cries',
            damage: 100,
            hacked: true,
          },
          {
            name: 'Potion',
            healing: 200,
          },
        ],
      })
    ).toThrow();
  });
});
