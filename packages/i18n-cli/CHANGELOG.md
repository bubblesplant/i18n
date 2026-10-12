# @bubblesjs/i18n-cli

## 0.0.6

### Patch Changes

- 6ceafb6: Excel 转换备份默认写入配置目录下的 .bubbles-i18n/backups，支持通过 excel.backupDir 自定义备份目录，同次转换以文件序号区分同名备份，并在扫描时排除配置的备份目录。
- 6ceafb6: 移除 CLI 的 --clean 和 --allow-empty 参数，清理统一使用 --prune；扫描为空时拒绝清空非空 JSON，同步更新帮助信息和生成报告中的命令说明。

## 0.0.5

### Patch Changes

- 48414b1: Excel 配置可整体省略，file 默认使用配置目录下的 .bubbles-i18n/<项目名>.xlsx，sheet 默认使用 sheet1，同时保留自定义文件和工作表名称。

## 0.0.4

### Patch Changes

- 9dc6a65: 默认将 sync 和 check 的 JSON 报告写入配置目录下的 .bubbles-i18n/report.json，支持 report: false 关闭报告，并保留自定义路径配置。

## 0.0.3

### Patch Changes

- d5deed3: 修改docs 并且实现cli json和excel 互转
- dbf3768: 补齐playground 的检查的时候没有类型声明

## 0.0.2

### Patch Changes

- 7ad9341: 第一次发布
