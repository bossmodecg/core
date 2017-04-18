import _ from 'lodash';

import fs from 'fs';

import express from 'express';
import morgan from 'morgan';
import socketio from 'socket.io';

import Ajv from 'ajv';

import { Logger } from '../logger';

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

export function loadOptions(optionsFile) {
  if (!fs.existsSync(optionsFile)) {
    throw new Error(`config file ${optionsFile} does not exist.`);
  }

  const opts = {};
  _.merge(opts, DEFAULT_OPTIONS, JSON.parse(fs.readFileSync(optionsFile, 'utf8')));
  opts.automaticPushdowns = opts.automaticPushdowns.map((i) => new RegExp(i, 'i'));

  return opts;
}

function loadBModuleConfig(basePath, bmName) {
  const configPath = `${basePath}/config/${bmName}.json`;
  logger.debug(`Loading config for bmodule '${bmName}' (${configPath}).`);

  if (!fs.existsSync(configPath)) {
    logger.debug(`No configuration for bmodule '${bmName}' found.`);
    return {};
  }

  logger.debug(`Configuration for bmodule '${bmName}' found, loading.`);
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function loadCustom(basePath, bmName) {
  // TODO: we should...make this...better.
  const packageName = `bossmodecg-module-${bmName}`;
  const nodeModuleRoot = `${basePath}/node_modules/${packageName}`;

  try {
    logger.info(`Loading bmodule '${bmName}' (node package ${packageName}).`);

    const packageJsonPath = `${nodeModuleRoot}/package.json`;

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`No package.json file found at: ${packageJsonPath}`);
    }

    const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath));
    const packageBMInfo = packageInfo.bossmodecg;

    const requireRelPath = (packageBMInfo && packageBMInfo.modulePath) ||
                            packageInfo.main || "index";

    const requireTarget = `${nodeModuleRoot}/${requireRelPath}`;

    logger.debug(`Requiring '${bmName}' module from ${requireTarget}.`);
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(requireTarget);
  } catch (err) {
    logger.error(`Error loading '${bmName}': ${err.message}`);

    throw err;
  }
}

export function loadBModules(basePath, bModuleList) {
  const validatorGenerator = new Ajv();

  const ret = {};

  bModuleList.forEach((bModuleName) => {
    const bmName = bModuleName.toLowerCase();

    const bModuleRequire = loadCustom(basePath, bmName);
    const bModuleConfig = loadBModuleConfig(basePath, bmName);

    const bModuleClass = bModuleRequire.default;
    const bModuleConfigSchema = bModuleRequire.configSchema;

    if (bModuleConfigSchema) {
      const validate = validatorGenerator.compile(bModuleConfigSchema);
      const valid = validate(bModuleConfig);

      if (!valid) {
        logger.error(`Schema validation failure for config for '${bmName}': ${validate.errors}`);
      }
    }

    // eslint-disable-next-line new-cap
    const mod = new bModuleClass(bModuleConfig);

    ret[mod.name] = mod;
  });

  return ret;
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
