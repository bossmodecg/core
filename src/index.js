import BModule from './bmodule';
import Server from './server';

import defaultLogger, { Logger } from './logger';

const BossmodeCG = {
  BModule: BModule,
  Server: Server,
  Logger: Logger,
  logger: defaultLogger
};

export default BossmodeCG;
