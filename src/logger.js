import bunyan from "bunyan";
import PrettyStream from "bunyan-prettystream";

const prettyStderr = new PrettyStream();
prettyStderr.pipe(process.stderr);

const streams = [
  {
    level: "debug",
    type: "raw",
    stream: prettyStderr
  }
];

const defaultLogger = bunyan.createLogger({
  name: "bmserver",
  streams
});

export default defaultLogger;
