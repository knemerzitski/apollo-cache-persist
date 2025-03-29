import Log from './Log';
import Storage from './Storage';
import Cache from './Cache';

import { ApolloPersistOptions, PersistenceMapperFunction } from './types';
import mitt, { Emitter } from 'mitt';

export interface PersistorConfig<T> {
  log: Log<T>;
  cache: Cache<T>;
  storage: Storage<T>;
}

export interface TriggerEvents {
  persisted: undefined;
  persistError: {
    error: unknown;
  };
  restored: undefined;
  restoreError: {
    error: unknown;
  };
  purged: undefined;
  purgeError: {
    error: unknown;
  };
}

export default class Persistor<T> {
  private _eventBus: Emitter<TriggerEvents> = mitt();
  get eventBus(): Pick<Emitter<TriggerEvents>, 'on' | 'off'> {
    return this._eventBus;
  }

  log: Log<T>;
  cache: Cache<T>;
  storage: Storage<T>;
  maxSize?: number;
  paused: boolean;
  persistenceMapper?: PersistenceMapperFunction;

  constructor(
    { log, cache, storage }: PersistorConfig<T>,
    options: Pick<ApolloPersistOptions<T>, 'maxSize' | 'persistenceMapper'>,
  ) {
    const { maxSize = 1024 * 1024, persistenceMapper } = options;

    this.log = log;
    this.cache = cache;
    this.storage = storage;
    this.paused = false;

    if (persistenceMapper) {
      this.persistenceMapper = persistenceMapper;
    }

    if (maxSize) {
      this.maxSize = maxSize;
    }
  }

  async persist(): Promise<void> {
    try {
      let data = this.cache.extract();

      if (!this.paused && this.persistenceMapper) {
        data = await this.persistenceMapper(data);
      }

      if (
        this.maxSize != null &&
        typeof data === 'string' &&
        data.length > this.maxSize &&
        !this.paused
      ) {
        await this.purge();
        this.paused = true;
        return;
      }

      if (this.paused) {
        return;
      }

      await this.storage.write(data);

      this.log.info(
        typeof data === 'string'
          ? `Persisted cache of size ${data.length} characters`
          : 'Persisted cache',
      );
      this._eventBus.emit('persisted');
    } catch (error) {
      this.log.error('Error persisting cache', error);
      this._eventBus.emit('persistError', {
        error,
      });
      throw error;
    }
  }

  async restore(): Promise<void> {
    try {
      const data = await this.storage.read();

      if (data != null) {
        await this.cache.restore(data);

        this.log.info(
          typeof data === 'string'
            ? `Restored cache of size ${data.length} characters`
            : 'Restored cache',
        );
      } else {
        this.log.info('No stored cache to restore');
      }
      this._eventBus.emit('restored');
    } catch (error) {
      this.log.error('Error restoring cache', error);
      this._eventBus.emit('restoreError', { error });
      throw error;
    }
  }

  async purge(): Promise<void> {
    try {
      await this.storage.purge();
      this.log.info('Purged cache storage');
      this._eventBus.emit('purged');
    } catch (error) {
      this.log.error('Error purging cache storage', error);
      this._eventBus.emit('purgeError', {
        error,
      });
      throw error;
    }
  }
}
