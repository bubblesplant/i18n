---
"@bubblesjs/i18n-cli": patch
---

Excel 转换备份默认写入配置目录下的 .bubbles-i18n/backups，支持通过 excel.backupDir 自定义备份目录，同次转换以文件序号区分同名备份，并在扫描时排除配置的备份目录。
