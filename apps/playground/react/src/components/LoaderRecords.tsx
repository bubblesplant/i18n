import { useSyncExternalStore } from "react";
import { localeLoads } from "@/i18n";
import { statusLabels } from "../shared/load-monitor";

export default function LoaderRecords() {
  const { items } = useSyncExternalStore(
    localeLoads.subscribe,
    localeLoads.getState,
    localeLoads.getState,
  );
  const loadedCount = items.filter((item) => item.status === "loaded").length;
  return (
    <section className="load-panel" aria-labelledby="load-title">
      <header className="load-heading">
        <div>
          <p className="eyebrow">LOADER MESSAGE</p>
          <h2 id="load-title">语言包加载记录</h2>
        </div>
        <span className="load-count">
          <strong>{loadedCount}</strong> / 4 个语言包已加载
        </span>
      </header>
      <p className="load-description">
        默认中文已静态导入，首屏加载器调用均为 0。点击对应区域的 English，观察英文包首次加载。
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">作用域</th>
              <th scope="col">语言包</th>
              <th scope="col">状态</th>
              <th scope="col">加载器调用</th>
            </tr>
          </thead>
          <tbody>
            {items.map((record) => (
              <tr
                key={`${record.scope}-${record.locale}`}
                data-scope={record.scope}
                data-locale={record.locale}
              >
                <td>
                  <span className={`table-scope ${record.scope}`}>
                    {record.scope === "global" ? "全局应用" : "局部项目"}
                  </span>
                </td>
                <td>
                  <code>
                    {record.scope}/{record.locale}.json
                  </code>
                </td>
                <td>
                  <span className={`load-status ${record.status}`}>
                    {statusLabels[record.status]}
                  </span>
                </td>
                <td>{record.calls} 次</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="load-footnote">
        这里只统计 loaderMessage 调用次数。加载失败时可切换回中文，刷新页面后重试。
      </p>
    </section>
  );
}
