/**
 * 投研工具路由加载态：切换左侧菜单时以同形骨架承接（标题 + 大块 + 双卡），
 * 扫光复用全局 .motion-skeleton；到达后由壳层的换页淡入接管，避免空白突现。
 */
export default function ResearchViewLoading() {
  return (
    <div className="research-loading" role="status">
      <span className="research-loading-sr">正在打开工具…</span>
      <div className="research-loading-title motion-skeleton" />
      <div className="research-loading-block motion-skeleton" />
      <div className="research-loading-row">
        <div className="research-loading-cell motion-skeleton" />
        <div className="research-loading-cell motion-skeleton" />
      </div>
    </div>
  );
}
