# @local/hero-decor — 主页美化

自定义 DeepSeek Harness 新对话主页(「探索未至之境」):

- 大标题文字、颜色(色板 + 色轮)、字号
- 新对话输入框(卡片)颜色(色板 + 色轮 + 不透明度)、最大宽度
- 「标题 + 输入框」整组的水平/垂直偏移

配置入口:**设置 → 主页美化**。设置页提供可视化"舞台":拖动代表聊天组的方块即可调整位置,所有修改在主页**实时预览**,点「保存」才永久生效(关闭设置页放弃未保存修改)。配置保存在浏览器的 localStorage 中。

## 工作原理

- 客户端通过 `conversation.hero.frame` hoc 槽在最外层包一层 `display:contents` 包装元素(`.dshd-frame[data-dshd-hero]`),作用域 CSS 全部挂在该包装元素上。
- 输入框颜色覆盖 token `--dsw-specific-input-major`;宽度覆盖官方布局变量 `--dsh-composer-card-max-width`;垂直偏移用 `translateY` 平移滚动体。
- 标题文字通过 MutationObserver 保持覆盖(标题文字 span 无自有类名,React 在语言切换时会重渲染);标题颜色/字号用 `div[class*="_headline"]` 模块键选择器,跨版本升级(哈希前缀变化)仍然有效。

## 限制

- 若未来版本重命名 CSS-module 键(`_titleGroup` 等),标题文字覆盖会静默失效回退默认文字;颜色/大小/宽度/偏移不受影响。
- 配置按浏览器存储;换浏览器或清空站点数据后恢复默认。
