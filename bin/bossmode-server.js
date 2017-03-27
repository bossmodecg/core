#! /usr/bin/env node

const CLI = require("../src/cli").default;

new CLI(process.argv).run();
