import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach } from "vite-plus/test";

/**
 * 注册测试生命周期钩子，在每个用例开始前创建独立临时目录，结束后递归清理其中的文件。
 *
 * @returns 通过 getter 动态读取当前用例目录路径的对象。
 */
export function useTemporaryDirectory(): { readonly path: string } {
  let path = "";

  beforeEach(async () => {
    path = await mkdtemp(join(tmpdir(), "bubbles-i18n-"));
  });

  afterEach(async () => {
    if (path !== "") {
      await rm(path, { recursive: true, force: true });
    }
  });

  return {
    get path() {
      return path;
    },
  };
}
