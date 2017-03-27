import Server from './server';
import { Logger } from './logger';

import commander from 'commander';
import fs from 'fs';
import pry from 'pryjs';

const logger = new Logger("cli");
const npmInfo = require('../package.json');

export default class CLI {
  constructor(args = []) {
    if (typeof(window) !== 'undefined') {
      throw new Error("This can only be instantiated in a NodeJS environment.");
    }

    this._args = args;

    this.run = this.run.bind(this);
  }

  async run() {
    logger.info("Instancing CLI application.");

    const commandParser = this._buildCommandParser();
    commandParser.parse(this._args);

    const workingDirectory = fs.realpathSync(commandParser.args[0] || ".");

    const server = new Server(workingDirectory);
    await server.run();
  }

  _buildCommandParser() {
    return commander
      .version(npmInfo.version)
      .usage("[path]");
  }
}
