import Trigger from '../Trigger';

jest.useFakeTimers();

describe('Trigger', () => {
  let cache: any;
  let persistor: any;
  let trigger: any;

  beforeEach(() => {
    cache = {
      write: jest.fn(),
    };
    persistor = {
      persist: jest.fn(),
    };
    trigger = new Trigger(
      {
        persistor,
        //@ts-expect-error
        log: {
          warn: jest.fn(),
        },
      },
      {
        cache,
      },
    );
  });

  describe('flush', () => {
    it('should persist immediately when pending', async () => {
      cache.write();
      trigger.flush();
      expect(persistor.persist).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when not pending', async () => {
      trigger.flush();
      expect(persistor.persist).toHaveBeenCalledTimes(0);
    });

    it('should do nothing when paused', async () => {
      cache.write();
      trigger.pause();
      trigger.flush();
      expect(persistor.persist).toHaveBeenCalledTimes(0);
    });
  });

  it('cancels pending', async () => {
    cache.write();
    trigger.cancel();
    jest.runAllTimers();
    expect(persistor.persist).toHaveBeenCalledTimes(0);
  });

  it('should isPending timeout has not run', async () => {
    expect(trigger.isPending()).toBeFalsy();
    cache.write();
    expect(trigger.isPending()).toBeTruthy();
    jest.runAllTimers();
    expect(trigger.isPending()).toBeFalsy();
  });
});
