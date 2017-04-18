import moment from 'moment';

export class Logger {
  constructor(category) {
    this._category = (category || _category || "unspecified").toLowerCase();

    this.error = this.error.bind(this);
    this.showError = true;
    this.warn = this.warn.bind(this);
    this.showWarn = true;
    this.info = this.info.bind(this);
    this.showInfo = true;
    this.debug = this.debug.bind(this);
    this.showDebug = true;
    this.trace = this.trace.bind(this);
    this.showTrace = false;
  }

  error(msg) {
    this.showError && console.log(`E ${moment().toISOString()} [${this._category}] ${this._handleMessage(msg)}`);
  }

  warn(msg) {
    this.showWarn && console.log(`W ${moment().toISOString()} [${this._category}] ${this._handleMessage(msg)}`);
  }

  info(msg) {
    this.showInfo && console.log(`I ${moment().toISOString()} [${this._category}] ${this._handleMessage(msg)}`);
  }

  debug(msg) {
    this.showDebug && console.log(`D ${moment().toISOString()} [${this._category}] ${this._handleMessage(msg)}`);
  }

  trace(msg) {
    this.showTrace && console.log(`T ${moment().toISOString()} [${this._category}] ${this._handleMessage(msg)}`);
  }

  _handleMessage(msg) {
    switch(typeof(msg)) {
      case 'function':
        return msg();
      case 'object':
        return JSON.stringify(msg);
      default:
        return msg;
    }
  }
}

export class ModuleLogger extends Logger {
  constructor(category) {
    super(`module-${category}`);
  }
}

const defaultLogger = new Logger("default");

export default defaultLogger;
