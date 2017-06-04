import express from 'express';
import morgan from 'morgan';
import socketio from 'socket.io';

import Logger from '../logger';

const logger = Logger.child({ component: "server" });

export const bossmodeCGHeaders =
  Object.freeze({
    clientType: "X-BossmodeCG-ClientType",
    identifier: "X-BossmodeCG-Identifier",
    passphrase: "X-BossmodeCG-Passphrase"
  });

export function buildHttpApp() {
  const app = express();

  app.use(morgan('combined'));

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, " +
                `${bossmodeCGHeaders.clientType}, ${bossmodeCGHeaders.identifier}, ` +
                `${bossmodeCGHeaders.passphrase}`);
    next();
  });

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
