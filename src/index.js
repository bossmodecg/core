import BModule from './bmodule';
import Server from './server';

import defaultLogger, { Logger } from './logger';

const BossmodeCG = {
  BModule,
  Server,
  Logger,
  logger: defaultLogger
};

export default BossmodeCG;
