import Logger from '../logger';
import { bossmodeCGHeaders } from './helpers';

export default class HttpWrapper {
  constructor(bmName, app, server) {
    this.get = this.get.bind(this);
    this.post = this.post.bind(this);
    this.put = this.put.bind(this);
    this.delete = this.delete.bind(this);

    this._bmName = bmName.toLowerCase();
    this._app = app;
    this._server = server;

    this._logger = Logger.child({ component: `http-${this._bmName}` });
  }

  get(path, fn) {
    const realHttpPath = `/modules/${this._bmName}${path}`;

    this._logger.info(`Registering endpoint 'GET ${path}' to real HTTP path: ${realHttpPath}`);
    this._app.get(realHttpPath, (request, response) => {
      const clientType = request.get(bossmodeCGHeaders.clientType);
      const identifier = request.get(bossmodeCGHeaders.identifier);
      const passphrase = request.get(bossmodeCGHeaders.passphrase);

      if (!this._server._validateClient(clientType, identifier, passphrase, false)) {
        response.status(401).send({ error: true, message: "bad login" });

        return null;
      }

      return fn(request, response);
    });
  }

  post(path, fn) {
    const realHttpPath = `/modules/${this._bmName}${path}`;
    this._logger.info(`Registering endpoint 'POST ${path}' to real HTTP path: ${realHttpPath}`);
    this._app.post(realHttpPath, (request, response) => {
      const clientType = request.get(bossmodeCGHeaders.clientType);
      const identifier = request.get(bossmodeCGHeaders.identifier);
      const passphrase = request.get(bossmodeCGHeaders.passphrase);

      if (!this._server._validateClient(clientType, identifier, passphrase, true)) {
        response.status(401).send({ error: true, message: "bad login" });

        return null;
      }

      return fn(request, response);
    });
  }

  put(path, fn) {
    const realHttpPath = `/modules/${this._bmName}${path}`;

    this._logger.info(`Registering endpoint 'PUT ${path}' to real HTTP path: ${realHttpPath}`);
    this._app.put(realHttpPath, (request, response) => {
      const clientType = request.get(bossmodeCGHeaders.clientType);
      const identifier = request.get(bossmodeCGHeaders.identifier);
      const passphrase = request.get(bossmodeCGHeaders.passphrase);

      if (!this._server._validateClient(clientType, identifier, passphrase, true)) {
        response.status(401).send({ error: true, message: "bad login" });

        return null;
      }

      return fn(request, response);
    });
  }

  delete(path, fn) {
    const realHttpPath = `/modules/${this._bmName}${path}`;

    this._logger.info(`Registering endpoint 'DELETE ${path}' to real HTTP path: ${realHttpPath}`);
    this._app.delete(realHttpPath, (request, response) => {
      const clientType = request.get(bossmodeCGHeaders.clientType);
      const identifier = request.get(bossmodeCGHeaders.identifier);
      const passphrase = request.get(bossmodeCGHeaders.passphrase);

      if (!this._server._validateClient(clientType, identifier, passphrase, true)) {
        response.status(401).send({ error: true, message: "bad login" });

        return null;
      }

      return fn(request, response);
    });
  }
}
