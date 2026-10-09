import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, extname, join } from "node:path";

/** 查找包管理器的原生程序或 JavaScript 入口，避免 Windows shell 引号问题。 */
export function packageManagerCommand(name) {
  const cliName = name === "npm" ? "npm-cli.js" : "pnpm.cjs";
  const environmentCli = process.env.npm_execpath;
  if (environmentCli && existsSync(environmentCli)) {
    if (environmentCli.endsWith(cliName)) {
      return { command: process.execPath, prefix: [environmentCli] };
    }
    if (name === "pnpm" && /pnpm[^/\\]*\.exe$/i.test(environmentCli)) {
      return { command: environmentCli, prefix: [] };
    }
  }
  const candidates = [join(dirname(process.execPath), "node_modules", name, "bin", cliName)];
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat"] : [""];
  for (const directory of (process.env.PATH ?? process.env.Path ?? "").split(delimiter)) {
    if (!directory) continue;
    const normalized = directory.replace(/^"|"$/g, "");
    candidates.push(join(normalized, "node_modules", name, "bin", cliName));
    for (const extension of extensions) {
      const executable = join(normalized, name + extension);
      if (existsSync(executable) && ![".cmd", ".bat"].includes(extname(executable))) {
        return { command: executable, prefix: [] };
      }
    }
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return { command: process.execPath, prefix: [candidate] };
  }
  throw new Error(`Cannot locate ${name}; install it before verifying packages.`);
}

/** 以参数数组运行命令，失败时保留诊断；调用方可指定预期退出码。 */
export function run(command, args, cwd, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    expectedStatus,
    `${command} failed:\n${result.stderr}\n${result.stdout}`,
  );
  return result.stdout;
}

/** 使用已定位的包管理器执行命令。 */
export function runPackageManager(name, args, cwd, expectedStatus = 0) {
  const { command, prefix } = packageManagerCommand(name);
  return run(command, [...prefix, ...args], cwd, expectedStatus);
}
