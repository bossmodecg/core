import http from 'http';
import fs from 'fs';
import fsp from 'fs-promise';

import { EventEmitter2 } from 'eventemitter2';

import { Logger } from '../logger';

import {
  loadOptions,
  loadBModules,
  buildHttpApp,
  buildSocketIO
} from './helpers';

const logger = new Logger("server");
const clientLogger = new Logger("client");

export default class Server extends EventEmitter2 {
  constructor(path) {
    super({ wildcard: true, newListener: false });

    process.on('unhandledRejection', (r) => {
      logger.error("!!! unhandled promise rejection !!!");
      console.log(r);
    });

    this._configureSocketIO = this._configureSocketIO.bind(this);
    this._postModuleRegistration = this._postModuleRegistration.bind(this);
    this._emitFullStateForClient = this._emitFullStateForClient.bind(this);
    this._attachIdentifiedClientEvents = this._attachIdentifiedClientEvents.bind(this);
    this._validateClientIdentity = this._validateClientIdentity.bind(this);
    this._moduleCachePath = this._moduleCachePath.bind(this);
    this.readModuleCache = this.readModuleCache.bind(this);
    this.writeModuleCache = this.writeModuleCache.bind(this);
    this.pushEvent = this.pushEvent.bind(this);

    this._path = path;

    if (!fs.existsSync(this._path)) {
      throw new Error(`${path} does not exist.`);
    }

    const pathStat = fs.lstatSync(this._path);
    if (!pathStat.isDirectory()) {
      throw new Error(`${path} is not a directory.`);
    }

    this._options = loadOptions(`${this._path}/config/server.json`);
    this._app = buildHttpApp();
    this._httpServer = http.Server(this._app);
    this._io = buildSocketIO(this._httpServer);
    this._bmodules = Object.freeze(loadBModules(this._path, this._options.modules));
  }

  get io() { return this._io; }
  get path() { return this._path; }

  async run() {
    logger.info("Registering all bmodules with the server.");

    await Promise.all(Object.values(this._bmodules).map(async (bmodule) => {
      await bmodule.register(this);

      bmodule.onAny((eventName, event) => {
        if (!eventName.startsWith("internal.")) {
          this.emit(`${bmodule.name}.${eventName}`, event);
        }
      });
    }));

    this._postModuleRegistration();
    this._configureSocketIO();

    this.emit("internal.beforeRun", this);
    this._httpServer.listen(this._options.http.port, () => {
      logger.info(`Web server listening on port ${this._options.http.port}.`);
    });
  }

  async setRemoteModuleState(bmName, stateDelta) {
    const bmodule = this._bmodules[bmName];

    if (!bmodule) {
      const err = `Attempted to set remote state for '${bmName}', but that module doesn't exist?`;
      logger.error(err);

      throw new Error(err);
    } else if (bmodule.moduleOptions.internalStateUpdatesOnly) {
      logger.warn(`Attempted to set remote state for '${bmName}', but that module disallows external state changes.`);

      return null;
    } else {
      return bmodule.setState(stateDelta);
    }
  }

  async readModuleCache(bmName) {
    const cachePath = this._moduleCachePath(bmName);
    logger.debug(`Loading cache for '${bmName}' from '${cachePath}'.`);

    if (await fsp.exists(cachePath)) {
      logger.trace(`Cache loaded for '${bmName}'.`);
      return JSON.parse(await fsp.readFile(cachePath));
    }

    logger.trace(`No cache found for '${bmName}'.`);
    return {};
  }

  async writeModuleCache(bmName, moduleState) {
    if (typeof moduleState !== 'object') {
      logger.warn(`Module '${bmName}' attempted to save a non-object cache. Probably a bug.`);
    } else {
      const cachePath = this._moduleCachePath(bmName);
      logger.trace(`Writing cache for '${bmName}' to '${cachePath}'.`);
      await fsp.writeFile(cachePath, JSON.stringify(moduleState));
    }
  }

  _moduleCachePath(bmName) {
    return `${this.path}/store/${bmName}.json`;
  }

  /**
   * Sends an event to all connected, authenticated clients.
   *
   * @param {*} eventName The name of the event.
   * @param {*} event Arbitrary JSON for an event.
   */
  pushEvent(eventName, event = {}) {
    Object.values(this._io.sockets.connected).forEach((client) => {
      if (client.identity) {
        client.emit(eventName, event);
      }
    });
  }

  _configureSocketIO() {
    this._io.on('connection', (client) => {
      /* eslint-disable no-param-reassign */
      client.error = (msg) => clientLogger.error(`Client '${client.id}': ${msg}`);
      client.warn = (msg) => clientLogger.warn(`Client '${client.id}': ${msg}`);
      client.info = (msg) => clientLogger.info(`Client '${client.id}': ${msg}`);
      client.debug = (msg) => clientLogger.debug(`Client '${client.id}': ${msg}`);
      client.trace = (msg) => clientLogger.trace(`Client '${client.id}': ${msg}`);
      /* eslint-enable no-param-reassign */

      client.info("Connected. Waiting for identify.");

      client.on('identify', (identifyEvent) => {
        // It shouldn't be possible to hit this because we unsubscribe from identify, but to be safe...
        if (client.identity) {
          client.warn("Attempted to re-identify after identify.");
          client.emit('clientError', { message: "can't re-identify; disconnect and reconnect (refresh)." });
        } else if (!this._validateClientIdentity(client, identifyEvent)) {
          client.warn("Failed authentication.");
          client.emit('clientError', { message: "authentication failed." });
        } else {
          client.info("Authentication succeeded.");

          // eslint-disable-next-line no-param-reassign
          client.identity = { identifier: identifyEvent.identifier, clientType: identifyEvent.clientType };
          this._attachIdentifiedClientEvents(client);
          client.emit('authenticationSucceeded');

          // TODO: remove the identify listener here
          // client.removeListener('identify', this._identifyClient);
          this.emit("internal.clientAuthenticated", client);
        }
      });

      client.on('disconnect', (reason) => {
        client.info(`Disconnected (${reason}).`);

        this.emit("internal.clientDisconnected", client);
      });

      this.emit("internal.clientConnected", client);
    });
  }

  _postModuleRegistration() {
    this.onAny((eventName, event) => {
      // The idea here is that applications probably know when they should have messages
      // pushed down to the client. The server will provide facilities for pushing messages
      // down to both dashboards and frontends; however, there are so many messages that
      // don't really need server-side processing that can just be passed straight through,
      // so here's how we do that.
      const automaticPushdowns = ((this._options || {}).automaticPushdowns || []);
      if (!eventName.startsWith("internal.") && automaticPushdowns.some((regex) => regex.test(eventName))) {
        logger.debug(`Automatic pushdown: ${eventName}`);
        this.pushEvent(eventName, event);
      }
    });

    this.on("internal.clientAuthenticated", (client) => {
      this._emitFullStateForClient(client);
    });
  }

  _attachIdentifiedClientEvents(client) {
    client.on('getFullState', () => {
      this._emitFullStateForSocket(client);
    });

    if (client.identity.clientType === 'management') {
      client.on('pushupEvent', (pushupEvent) => {
        const bmName = pushupEvent.bmName;
        const eventName = pushupEvent.eventName;
        const event = pushupEvent.event;

        const mod = this._bmodules[bmName];

        if (!mod) {
          client.warn(`Received client message from '${bmName}' but no module found.`);
        } else {
          const whitelist = mod._moduleOptions.managementEventWhitelist;

          if (!whitelist || whitelist.some((regex) => regex.test(eventName))) {
            client.debug(`Pushing '${eventName}' to module '${bmName}'.`);
            mod.emit(eventName, event);
          }
        }
      });

      client.on('stateDelta', (stateDeltaEvent) => {
        const bmName = stateDeltaEvent.bmName;
        const delta = stateDeltaEvent.delta;

        client.debug(`Received stateDelta for module '${bmName}'.`);
        this.setRemoteModuleState(bmName, delta);
      });
    }
  }

  _validateClientIdentity(client, identifyEvent) {
    const clientType = identifyEvent.clientType;

    if (clientType === 'frontend') {
      client.trace("Is a frontend client.");
      const frontendAuth = this._options.frontendAuth;

      if (!frontendAuth) {
        client.trace("No frontendAuth config defined; assuming open auth.");
        return true;
      }

      const passphrase = frontendAuth[identifyEvent.identifier];
      if (!passphrase) {
        client.trace("No passphrase provided.");
        return false;
      }

      const passphraseMatches = passphrase === identifyEvent.passphrase;
      if (passphraseMatches) {
        client.trace("Passphrase matches.");
      } else {
        client.trace("Passphrase does not match.");
      }

      return passphraseMatches;
    } else if (clientType === 'management') {
      const managementAuth = this._options.managementAuth;

      if (!managementAuth) { return true; }

      const passphrase = managementAuth[identifyEvent.identifier];
      if (!passphrase) { return false; }

      return passphrase === identifyEvent.passphrase;
    }

    client.warn(`Unrecognized client type '${clientType}'.`);
    client.emit('clientError', { message: `unrecognized client type '${clientType}'.` });
    return false;
  }

  _emitFullStateForClient(client) {
    const fullState = {};
    Object.keys(this._bmodules).forEach((bmName) => {
      fullState[bmName] = this._bmodules[bmName].safeState;

      return fullState[bmName];
    });

    client.emit('state', fullState);
  }
}
