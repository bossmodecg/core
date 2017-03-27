import { Logger } from '../logger';

import express from 'express';
import morgan from 'morgan';
import socketio from 'socket.io';

import fs from 'fs';
import _ from 'lodash';
import Ajv from 'ajv';

const logger = new Logger("server");

const DEFAULT_OPTIONS =
  {
    http: {
      port: 12800
    },
    sockets: {

    },
    modules: [],
    automaticPushdowns: []
  };

export function loadOptions(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`config file ${path} does not exist.`);
  }

  const opts = {};
  _.merge(opts, DEFAULT_OPTIONS, JSON.parse(fs.readFileSync(path, 'utf8')));
  opts.automaticPushdowns = opts.automaticPushdowns.map((i) => new RegExp(i, 'i'));

  return opts;
}

function loadBModuleConfig(path, bmName) {
  const configPath = `${path}/config/${bmName}.json`
  logger.debug(`Loading config for bmodule '${bmName}' (${configPath}).`);

  if (!fs.existsSync(configPath)) {
    logger.debug(`No configuration for bmodule '${bmName}' found.`);
    return {};
  } else {
    logger.debug(`Configuration for bmodule '${bmName}' found, loading.`);
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
}

export function loadBModules(path, bModuleList) {
  const validatorGenerator = new Ajv();

  const ret = {};

  bModuleList.forEach((bModuleName) => {
    const bmName = bModuleName.toLowerCase();

    const bModuleRequire = loadCustom(path, bmName);
    const bModuleConfig = loadBModuleConfig(path, bmName);

    const bModuleClass = bModuleRequire.default;
    const bModuleConfigSchema = bModuleRequire.configSchema;

    if (bModuleConfigSchema) {
      const validate = validatorGenerator.compile(bModuleConfigSchema);
      const valid = validate(bModuleConfig);

      if (!valid) {
        logger.error(`Schema validation failure for config for '${bmName}': ${validate.errors}`);
      }
    }

    ret[bmName] = new bModuleClass(bModuleConfig);
  });

  return ret;
}

function loadCustom(path, bmName) {
  const packageName = `bossmodecg-module-${bmName}`;
  const nodeModulePath = `${path}/node_modules/${packageName}/dist/bmodule`;

  try {
    logger.info(`Loading bmodule '${bmName}' (node package ${packageName}).`);
    logger.debug(`Requiring '${bmName}' class from ${nodeModulePath}.`);
    return require(nodeModulePath);
  } catch (e) {
    logger.error(`Failure when loading bmodule '${bmName}': ${e.message}`)

    throw e;
  }
}

export function buildHttpApp() {
  const app = express();

  app.use(morgan('combined'));

  logger.debug("Specifying GET /health-check");
  app.get('/health-check',
    (req, res) => {
      res.status(200).send({ ok: true });
    });

  return app;
}

export function buildSocketIO(httpServer) {
  const io = socketio(httpServer);

  io.origins('*:*');

  return io;
}
