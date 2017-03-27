import Http from './http';
import BModule from './bmodule';

import defaultLogger, { Logger } from './logger';

const BossmodeCG = {
  BModule: BModule,
  Http: Http,
  Logger: Logger,
  logger: defaultLogger
};

export default BossmodeCG;
