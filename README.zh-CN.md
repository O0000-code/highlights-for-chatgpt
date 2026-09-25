<div align="right">

[English](./README.md) · **中文**

</div>

<br />

<div align="center">

# highlights-for-chatgpt

**留下真正重要的内容，不再重新寻找。**
<br/>
一个自然融入 ChatGPT 的高亮层：自动恢复、精确跳转、Library 管理与本地导出。

<br/>

<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-000?style=flat-square" alt="MIT license"/></a>
<img src="https://img.shields.io/badge/version-0.3.9-000?style=flat-square" alt="v0.3.9"/>
<img src="https://img.shields.io/badge/privacy-local_only-000?style=flat-square" alt="Local only"/>
<img src="https://img.shields.io/badge/browser-Chromium-000?style=flat-square" alt="Chromium"/>

</div>

<br/>

## 它做什么

ChatGPT 的长对话很好读，却很难回头寻找某一句真正有用的内容。选中文字，点击
**Highlight**，再次打开这个对话时，高亮会自动恢复。

- 四种克制的颜色，可在同一个小弹框中换色或取消高亮。
- 每个高亮对应一个页面边缘标记；悬停预览，点击返回原文。
- 在 ChatGPT Library 中加入 **Highlights**，支持搜索、颜色筛选、预览、
  返回来源和按选择导出。
- 从本地存储导出 Markdown、纯文本或可恢复的 JSON 备份。
- 可选地与指定的 ChatGPT Markdown 导出插件联动，在当前对话导出时保留
  高亮文字和颜色。

没有弹窗、侧栏、标签表单、账号、云服务、统计、广告、AI 处理或远程代码。

<br/>

## 交互路径

```text
选中文字  →  Highlight  →  随时重新打开  →  精确跳回原文
                                     ↓
                              Library · 导出
```

插件直接加入 ChatGPT 现有的文字选择工具栏。点击已有高亮会打开同样克制的
颜色选择器，最右侧是取消高亮。定位条与 ChatGPT 自己的对话跳转条共用节奏，
不会在页面边缘再制造一套互相竞争的界面。

<br/>

## Library

![在阅读位置高亮](assets/store/01-highlight-where-you-read-1280x800.png)

Library 以对话为第一层，而不是把数据库原样堆给用户。搜索和颜色筛选负责缩小
当前范围；预览一次只打开一个片段；复选框只在需要选择时出现。列表和网格复用
ChatGPT 当前加载的组件尺寸与主题变量，并为宿主变化保留隔离的降级样式。

<br/>

## 为什么不会破坏页面结构

高亮由浏览器的
[CSS Custom Highlight API](https://developer.mozilla.org/docs/Web/API/CSS_Custom_Highlight_API)
绘制。插件记录文字范围，不会包裹、拆分或重新挂载 ChatGPT 的消息 DOM，因此
段落、强调、列表、换行和页面层级都保持原样。

恢复过程综合精确文字、前后文、重复位置、空白归一化，以及针对 ChatGPT 动态渲染
的延迟校准。

<br/>

## 隐私

选中文字、少量定位上下文、对应的对话网址和标题、颜色及时间戳，都只保存在扩展
自己的 IndexedDB 中。项目没有开发者服务器，也没有遥测；数据不会发送给开发者
或第三方。

可选的导出联动使用浏览器内部的扩展间通信，只允许一个明确指定的扩展，并限制为
当前对话。网页脚本无法读取这些记录，数据也不会经过网络服务。

完整说明见[隐私政策](PRIVACY.md)与[支持指南](SUPPORT.md)。

<br/>

## 安装

Chrome 应用商店页面正在审核中。审核通过前，可从源码安装：

```bash
git clone https://github.com/O0000-code/highlights-for-chatgpt.git
cd highlights-for-chatgpt
bun install --frozen-lockfile
bun run verify
```

打开 Chromium 浏览器的扩展管理页面，启用**开发者模式**，选择**加载已解压的扩展程序**，
然后选择 `dist/`。

<br/>

## 开发

```bash
bun run fix
bun run typecheck
bun run test
bun run build
bun run package
```

未打包扩展输出到 `dist/`，发布 ZIP 输出到 `releases/`。商店截图全部使用合成内容，
不包含真实对话。

<br/>

## 范围、致谢与许可证

产品边界记录在 [docs/product-scope.md](docs/product-scope.md)。项目明确不做账号、
同步、统计、标签、笔记、参与度功能、自定义主题，也不直接依赖 ChatGPT 的私有
React 内部实现。

Highlights for ChatGPT 是独立项目，与 OpenAI 没有从属、认可或赞助关系。
ChatGPT 是 OpenAI 的商标。

本项目的本地优先定位思路受到 Threadmark MIT 开源实现的启发。准确的致谢和依赖
许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

MIT — 见 [LICENSE](LICENSE)。
