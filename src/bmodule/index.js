import { ModuleLogger } from '../logger';

import NodeAsyncLocks from 'node-async-locks';
import _ from 'lodash';

const jsondiffpatch = require('jsondiffpatch').create({});

const DEFAULT_MODULE_OPTIONS =
  Object.freeze(
    {
      internalStateUpdatesOnly: false,
      shouldCacheState: true,
      readCacheCallback: (cacheState) => cacheState
    }
  );

export default class BModule {
  constructor(name, config, moduleOptions) {
    this.register = this.register.bind(this);
    this._doRegister = this._doRegister.bind(this);

    this._name = name.toLowerCase();
    this._config = config;
    this._logger = new ModuleLogger(name);
    this._moduleOptions = {};
    _.merge(this._moduleOptions, DEFAULT_MODULE_OPTIONS, moduleOptions);

    this._state = {};
  }

  get name() { return this._name; }
  get logger() { return this._logger; }
  get config() { return this._config; }
  get server() { return this._server; }
  get moduleOptions() { return this._moduleOptions; }

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

  /**
   * Emits an event on the server bus (NOT this module itself). Prepends the name of the
   * event provided to this method as a namespace, i.e. module 'example' will emit its
   * 'exampleEvent' and listeners should key on 'example.exampleEvent'.
   *
   * If you need to emit an event that does not conform to your namespace, call `this.server.emit`
   * manually.
   *
   * @param {string} eventName The name of the event (which will be namespaced for this module).
   * @param {*} a0 arbitrary parameter for the callback
   * @param {*} a1 arbitrary parameter for the callback
   * @param {*} a2 arbitrary parameter for the callback
   * @param {*} a3 arbitrary parameter for the callback
   * @param {*} a4 arbitrary parameter for the callback
   * @param {*} a5 arbitrary parameter for the callback
   * @param {*} a6 arbitrary parameter for the callback
   * @param {*} a7 arbitrary parameter for the callback
   */
  async emit(eventName, a0, a1, a2, a3, a4, a5, a6, a7) {
    this.server.emit(`${this.name}.${eventName}`, a0, a1, a2, a3, a4, a5, a6, a7);
  }

  /**
   * Emits an event on the server bus (NOT this module itself). Prepends the name of the
   * event provided to this method as a namespace, i.e. module 'example' will emit its
   * 'exampleEvent' and listeners should key on 'example.exampleEvent'. Unlike emit(),
   * emitAsync() returns a promise that will return the results of all listeners.
   *
   * If you need to emit an event that does not conform to your namespace, call
   * `this.server.emitAsync` manually.
   *
   * @param {string} eventName The name of the event (which will be namespaced for this module).
   * @param {*} a0 arbitrary parameter for the callback
   * @param {*} a1 arbitrary parameter for the callback
   * @param {*} a2 arbitrary parameter for the callback
   * @param {*} a3 arbitrary parameter for the callback
   * @param {*} a4 arbitrary parameter for the callback
   * @param {*} a5 arbitrary parameter for the callback
   * @param {*} a6 arbitrary parameter for the callback
   * @param {*} a7 arbitrary parameter for the callback
   */
  async emitAsync(eventName, a0, a1, a2, a3, a4, a5, a6, a7) {
    return this.server.emitAsync(`${this.name}.${eventName}`, a0, a1, a2, a3, a4, a5, a6, a7);
  }

  async pushEvent(eventName, event) {
    this.server.pushEvent(`${this.name}.${eventName}`, event);
  }

  async _doRegister(server) {
    throw new Error("BModule implementations must override _doRegister().");
  }
}
