#!/usr/bin/env node

import { main } from "./command.ts";

void main().then((exitCode) => {
  process.exitCode = exitCode;
});
