import { Logger } from '../logger';

import { EventEmitter2 } from 'eventemitter2';

import http from 'http';
import fs from 'fs';
import fsp from 'fs-promise';
import _ from 'lodash';

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
      logger.error(`Attempted to set remote state for '${bmName}', but that module doesn't exist?`);
    } else {
      if (bmodule.moduleOptions.internalStateUpdatesOnly) {
        logger.warn(`Attempted to set remote state for '${bmName}', but that module disallows external state changes.`);
      } else {
        return await bmodule.setState(stateDelta);
      }
    }
  }

  async readModuleCache(bmName) {
    const cachePath = this._moduleCachePath(bmName);
    logger.debug(`Loading cache for '${bmName}' from '${cachePath}'.`)

    if (await fsp.exists(cachePath)) {
      logger.trace(`Cache loaded for '${bmName}'.`);
      return JSON.parse(await fsp.readFile(cachePath));
    } else {
      logger.trace(`No cache found for '${bmName}'.`);
      return {};
    }
  }

  async writeModuleCache(bmName, moduleState) {
    if (typeof(moduleState) !== 'object') {
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
  async pushEvent(eventName, event = {}) {
    Object.values(this._io.sockets.connected).forEach((client) => {
      if (client.identity) {
        client.emit(eventName, event);
      }
    })
  }

  _configureSocketIO() {
    this._io.on('connection', (client) => {
      client.error_log = (msg) => clientLogger.error(`Client '${client.id}': ${msg}`);
      client.warn_log = (msg) => clientLogger.warn(`Client '${client.id}': ${msg}`);
      client.info_log = (msg) => clientLogger.info(`Client '${client.id}': ${msg}`);
      client.debug_log = (msg) => clientLogger.debug(`Client '${client.id}': ${msg}`);
      client.trace_log = (msg) => clientLogger.trace(`Client '${client.id}': ${msg}`);

      client.info_log("Connected. Waiting for identify.");

      client.on('identify', (identifyEvent) => {
        // It shouldn't be possible to hit this because we unsubscribe from identify, but to be safe...
        if (client.identity) {
          client.warn_log("Attempted to re-identify after identify.");
          client.emit('clientError', { message: "can't re-identify; disconnect and reconnect (refresh)." });
        } else {
          if (!this._validateClientIdentity(client, identifyEvent)) {
            client.warn_log("Failed authentication.");
            client.emit('clientError', { message: "authentication failed." });
          } else {
            client.info_log("Authentication succeeded.");
            client.identity = { identifier: identifyEvent.identifier, clientType: identifyEvent.clientType };
            this._attachIdentifiedClientEvents(client);
            client.emit('authenticationSucceeded');

            // TODO: remove the identify listener here
            // client.removeListener('identify', this._identifyClient);
            this.emit("internal.clientAuthenticated", client);
          }
        }
      });

      client.on('disconnect', (reason) => {
        client.info_log(`Disconnected (${reason}).`);

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
        logger.trace(`Automatic pushdown: ${eventName}`);
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
  }

  _validateClientIdentity(client, identifyEvent) {
    const clientType = identifyEvent.clientType;

    if (clientType === 'frontend') {
      client.trace_log("Is a frontend client.");
      const frontendAuth = this._options.frontendAuth;

      if (!frontendAuth) {
        client.trace_log("No frontendAuth config defined; assuming open auth.");
        return true;
      }

      const passphrase = frontendAuth[identifyEvent.identifier];
      if (!passphrase) {
        client.trace_log("No passphrase provided.");
        return false;
      }

      const passphraseMatches = passphrase === identifyEvent.passphrase;
      if (passphraseMatches) {
        client.trace_log("Passphrase matches.");
      } else {
        client.trace_log("Passphrase does not match.");
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
    client.emit('clientError', { message: `unrecognized client type '${clientType}'.`});
    return false;
  }

  _emitFullStateForClient(client) {
    Object.keys(this._bmodules).forEach((bmName) => {
      client.emit('state', { bmName: bmName, state: this._bmodules[bmName].safeState });
    });
  }
}
