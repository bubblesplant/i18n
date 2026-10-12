/** 顶部负责切换栏目，左侧只展示当前栏目的章节。 */
export const guidePages = [
  {
    text: "快速开始",
    link: "/guide/getting-started",
    sections: [
      ["安装与接入方式", "选择你的接入方式"],
      ["准备语言包", "准备语言-json"],
      ["创建容器与切换语言", "创建容器与切换语言"],
      ["在框架中使用", "在-vue-react-中显示译文"],
      ["CLI 词条维护", "用-cli-扫描项目并维护-json"],
      ["本地开发", "在本仓库开发文档与示例"],
    ],
  },
  {
    text: "实现思路",
    link: "/guide/architecture",
    sections: [
      ["完整流程", "先看完整流程"],
      ["扁平 JSON 词条", "词条为何使用扁平-json"],
      ["CLI 源码扫描", "cli-如何把项目扫描成-json"],
      ["翻译与语言切换", "core-如何翻译和切换语言"],
      ["框架组件更新", "react-与-vue-如何更新组件"],
      ["JSON 与 Excel 协作", "json-⇄-excel-如何协作"],
      ["对照源码阅读", "对照源码阅读"],
    ],
  },
  {
    text: "核心容器",
    link: "/guide/core",
    sections: [
      ["安装", "安装"],
      ["默认语言与按需切换", "默认语言与按需切换"],
      ["词条与翻译", "初始词条与翻译"],
      ["插值", "插值"],
      ["订阅与状态", "订阅与状态"],
      ["持久化语言偏好", "持久化语言偏好"],
      ["API 参考", "api-参考"],
    ],
  },
  {
    text: "React",
    link: "/guide/react",
    sections: [
      ["安装", "_1-安装"],
      ["准备语言包", "_2-准备-json-语言包"],
      ["创建容器", "_3-显式导入默认语言并创建容器"],
      ["接入 Provider", "_4-在应用入口接入-provider"],
      ["组件翻译与切换语言", "_5-在组件中翻译和切换语言"],
      ["局部语言", "局部使用-独立项目语言"],
      ["组件外使用", "在组件外使用"],
      ["订阅与选择器", "直接订阅与选择器"],
      ["服务端渲染", "服务端渲染"],
      ["API 参考", "导出-api"],
    ],
  },
  {
    text: "Vue",
    link: "/guide/vue",
    sections: [
      ["安装", "_1-安装"],
      ["准备语言包", "_2-准备-json-语言包"],
      ["创建容器", "_3-显式导入默认语言并创建容器"],
      ["接入 Provider", "_4-接入-provider-并启动应用"],
      ["组件翻译与切换语言", "_5-在组件中翻译和切换语言"],
      ["局部语言", "局部使用-独立项目语言"],
      ["组件外使用", "在组件外使用"],
      ["订阅与生命周期", "直接订阅与生命周期"],
      ["服务端渲染", "provider-容器与服务端渲染"],
      ["API 参考", "导出-api"],
    ],
  },
  {
    text: "全局与局部",
    link: "/guide/scopes",
    sections: [
      ["准备语言包", "按作用域准备语言包"],
      ["创建独立容器", "创建两个独立容器"],
      ["框架接入", "接入-react-与-vue"],
      ["运行 Playground", "运行-playground"],
    ],
  },
  {
    text: "词条 CLI",
    link: "/guide/cli",
    sections: [
      ["核心流程", "核心流程与实现思路"],
      ["安装与配置", "安装与配置"],
      ["JSON 与 Excel 工作流", "excel-workflow"],
      ["命令、参数与退出码", "命令、参数与退出码"],
      ["处理规则", "各种情况如何处理"],
      ["保留 Excel 译文并清理", "excel-export-prefer-excel"],
      ["报告与备份", "reports"],
      ["扫描与 Excel 的边界", "扫描与-excel-的边界"],
      ["单元格格式与排查", "excel-cell-format"],
      ["编程 API", "编程-api"],
    ],
  },
] satisfies {
  text: string;
  link: string;
  sections: [text: string, anchor: string][];
}[];

export const guideSidebar = Object.fromEntries(
  guidePages.map(({ link, sections }) => [
    link,
    [
      {
        text: "本页内容",
        items: sections.map(([text, anchor]) => ({ text, link: `${link}#${anchor}` })),
      },
    ],
  ]),
);
