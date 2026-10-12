---
"@bubblesjs/i18n-cli": patch
---

移除 CLI 的 --clean 和 --allow-empty 参数，清理统一使用 --prune；扫描为空时拒绝清空非空 JSON，同步更新帮助信息和生成报告中的命令说明。
