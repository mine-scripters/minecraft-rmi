import { world, system } from '@minecraft/server';
import { sendMessage } from './Client';
import { startServer } from './Server';
import { SchemaEntryType } from './Schema';

describe('MinecraftRMI', () => {
  const runCommand = world.getDimension('').runCommand;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    (system as any).reset();
  });

  it('Unhandled sendMessage', async () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.123456789);
    jest.useFakeTimers();

    const promise = sendMessage('my_addon', 'stuff', undefined, 60);

    expect(runCommand).toHaveBeenCalledWith(
      'scriptevent minescripters_my_addon:rmi.event-payload {"id":"4fzzzxjylrx","endpoint":"stuff","hasArguments":false,"timeout":60}'
    );
    expect(runCommand).toHaveBeenCalledTimes(1);

    jest.runAllTimers();
    await expect(promise).rejects.toThrow('Timeout: Timed out trying to run stuff of my_addon');
  });

  it('starts server subscribes once', () => {
    startServer({
      namespace: 'my_addon',
      endpoints: {},
    });
    expect(system.afterEvents.scriptEventReceive.subscribe).toHaveBeenCalledTimes(1);
  });

  it('collaboration wrong endpoint', async () => {
    jest.useFakeTimers();
    jest.spyOn(global.Math, 'random').mockReturnValue(0.123456789);
    startServer({
      namespace: 'my_addon',
      endpoints: {},
    });

    const promise = sendMessage('my_addon', 'stuff', undefined, 60);

    expect(runCommand).toHaveBeenCalledWith(
      'scriptevent minescripters_my_addon:rmi.event-payload {"id":"4fzzzxjylrx","endpoint":"stuff","hasArguments":false,"timeout":60}'
    );
    expect(runCommand).toHaveBeenCalledTimes(2);

    await expect(promise).rejects.toThrow('Endpoint stuff not found');
  });

  it('collaboration - call endpoint', async () => {
    jest.useFakeTimers();
    jest.spyOn(global.Math, 'random').mockReturnValue(0.123456789);
    startServer({
      namespace: 'my_addon',
      endpoints: {
        stuff: {
          handler: () => {
            return 'foo';
          },
        },
      },
    });

    const promise = sendMessage('my_addon', 'stuff', undefined, 60);
    await expect(promise).resolves.toEqual('foo');
  });

  it('collaboration wrong input', async () => {
    jest.useFakeTimers();
    jest.spyOn(global.Math, 'random').mockReturnValue(0.123456789);
    startServer({
      namespace: 'my_addon',
      endpoints: {
        stuff: {
          handler: (_a: number, _b: string) => {
            return true;
          },
          schema: {
            arguments: [SchemaEntryType.NUMBER, SchemaEntryType.STRING],
          },
        },
      },
    });

    await expect(async () => sendMessage('my_addon', 'stuff', ['foo', 3], 60)).rejects.toThrow(
      'Error: Invalid schema, not a number (or bigint)"'
    );
  });

  it('collaboration - call endpoint with params', async () => {
    jest.useFakeTimers();
    jest.spyOn(global.Math, 'random').mockReturnValue(0.123456789);
    startServer({
      namespace: 'my_addon',
      endpoints: {
        stuff: {
          handler: (arg1: number, arg2: number) => {
            return arg1 + arg2;
          },
        },
      },
    });

    const promise = sendMessage('my_addon', 'stuff', [1, 2], 60);
    await expect(promise).resolves.toEqual(3);
  });

  it('collaboration - call endpoint with params no return', async () => {
    jest.useFakeTimers();
    startServer({
      namespace: 'my_addon',
      endpoints: {
        stuff: {
          handler: (_arg1: number, _arg2: number) => {},
        },
      },
    });

    const promise = sendMessage('my_addon', 'stuff', [1, 2], 60);
    await expect(promise).resolves.toEqual(undefined);
  });
});
