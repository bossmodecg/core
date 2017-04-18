import { EventEmitter2 } from 'eventemitter2';
import { ModuleLogger } from '../logger';

import NodeAsyncLocks from 'node-async-locks';
import _ from 'lodash';

const jsondiffpatch = require('jsondiffpatch').create({});

const DEFAULT_MODULE_OPTIONS =
  Object.freeze(
    {
      internalStateUpdatesOnly: false,
      managementEventWhitelist: null,
      shouldCacheState: true,
      readCacheCallback: (cacheState) => cacheState
    }
  );

export default class BModule extends EventEmitter2 {
  constructor(name, config, moduleOptions) {
    super({ wildcard: true, newListener: false });

    this.register = this.register.bind(this);
    this._doRegister = this._doRegister.bind(this);
    this.emit = this.emit.bind(this);
    this.emitAsync = this.emitAsync.bind(this);
    this.on = this.on.bind(this);

    this._name = name.toLowerCase();
    this._config = config;
    this._logger = new ModuleLogger(name);
    this._moduleOptions = Object.freeze(_.merge({}, DEFAULT_MODULE_OPTIONS, moduleOptions));

    this._state = {};
  }

  get name() { return this._name; }
  get logger() { return this._logger; }
  get config() { return this._config; }
  get server() { return this._server; }
  get moduleOptions() { return this._moduleOptions; }

  get state() { return this._state; }
  get safeState() { return _.cloneDeep(this._state); }

  async register(server) {
    this._server = server;

    if (this._moduleOptions.shouldCacheState) {
      this._state = this._moduleOptions.readCacheCallback(await this.server.readModuleCache(this._name));
    }

    await this._doRegister(server);
  }

  /**
   * Updates the current state of the module. This is a recursive merge of the
   * current state and the object provided (so arrays will be overwritten, that
   * must be handled manually). If this module is configured to cache state,
   * this method will not return until the cache has been written (and so you
   * shouldn't await on it).
   *
   * This method also locks; only one state modification can be in progress at
   * any time.
   *
   * @param {object} stateDelta the delta to apply to the module state.
   */
  async setState(stateDelta) {
    // TODO: we should figure out a way to delete keys. Setting to null is suboptimal.
    const newState =
      await NodeAsyncLocks.lockPromise(`${this.name}-state`, async () => {
        const oldState = this._state;
        const newState = _.merge({}, newState, this._state, stateDelta);

        this._state = newState;

        if (this._moduleOptions.shouldCacheState) {
          await this.server.writeModuleCache(this.name, this._state);
        }

        const delta = jsondiffpatch.diff(oldState, newState);
        const deltaEvent = { bmName: this.name, delta: delta };

        this.emit("stateChanged", { state: newState, delta: delta });
        this.server.pushEvent("stateDelta", deltaEvent);

        return this._state;
      });

    return newState;
  }

  pushEvent(eventName, event) {
    this.server.pushEvent(`${this.name}.${eventName}`, event);
  }

  async _doRegister(server) {
    throw new Error("BModule implementations must override _doRegister().");
  }
}
