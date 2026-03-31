#!/usr/bin/env node

import { run } from "./cli.js";

run(process.argv).catch((err: unknown) => {
  process.stderr.write(`Error: ${String(err)}\n`);
  process.exit(2);
});
