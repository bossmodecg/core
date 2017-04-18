#! /usr/bin/env node

const CLI = require("../dist/cli").default;

new CLI(process.argv).run();
