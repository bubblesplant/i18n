import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export interface SyncFileReport {
  project: string;
  path: string;
  locale: string;
  added: string[];
  unused: string[];
  deleted: string[];
  unchangedCount: number;
}

export interface SyncReport {
  command: "sync" | "check";
  clean: boolean;
  dryRun: boolean;
  files: SyncFileReport[];
}

export interface CreateSyncReportOptions {
  command?: SyncReport["command"];
  clean?: boolean;
  dryRun?: boolean;
  files?: readonly SyncFileReport[];
}

/** 填充同步报告的默认选项，并复制各文件的变更数组以隔离调用方修改。 */
export function createSyncReport(options: CreateSyncReportOptions = {}): SyncReport {
  return {
    command: options.command ?? "sync",
    clean: options.clean ?? false,
    dryRun: options.dryRun ?? false,
    files: (options.files ?? []).map((file) => ({
      ...file,
      added: [...file.added],
      unused: [...file.unused],
      deleted: [...file.deleted],
    })),
  };
}

/** 将报告写入同目录临时文件后重命名替换目标；失败时清理临时文件并传播异常。 */
export async function writeSyncReport(report: SyncReport, path: string): Promise<void> {
  const content = `${JSON.stringify(report, undefined, 2)}\n`;
  const directory = dirname(path);
  const temporaryPath = join(directory, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
