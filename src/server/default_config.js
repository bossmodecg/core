import path from 'path';

import tmp from 'tmp';

const rootPath = path.dirname(process.argv[1]);

const defaultConfig = {
  auth: {

  },
  http: {
    port: 12800
  },
  paths: {
    root: rootPath,
    store: path.join(rootPath, "store"),
    temp: tmp.dirSync({ unsafeCleanup: true }).name
  },
  automaticPushdowns: []
};

export default defaultConfig;
