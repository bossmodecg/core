import Server from './server';

import defaultLogger, { Logger } from './logger';

const BossmodeCG = {
  Server,
  Logger,
  logger: defaultLogger
};

export default BossmodeCG;
