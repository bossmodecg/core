import moment from 'moment';

export class Logger {
  constructor(category) {
    this._category = (category || _category || "unspecified").toLowerCase();

    this.error = this.error.bind(this);
    this.warn = this.warn.bind(this);
    this.info = this.info.bind(this);
    this.debug = this.debug.bind(this);
  }

  error(msg) {
    console.error(`E ${moment().toISOString()} [${this._category}] ${msg}`);
  }

  warn(msg) {
    console.error(`W ${moment().toISOString()} [${this._category}] ${msg}`);
  }

  info(msg) {
    console.log(`I ${moment().toISOString()} [${this._category}] ${msg}`);
  }

  debug(msg) {
    console.log(`D ${moment().toISOString()} [${this._category}] ${msg}`);
  }

  trace(msg) {
    console.log(`T ${moment().toISOString()} [${this._category}] ${msg}`);
  }
}

export class ModuleLogger extends Logger {
  constructor(category) {
    super(`module-${category}`);
  }
}

const defaultLogger = new Logger("default");

export default defaultLogger;
