# Reuse and component matrix

## Capability reuse map

| Capability | Source | License | Revision | Reuse shape | Local boundary and exit strategy |
| --- | --- | --- | --- | --- | --- |
| Local persistence and text re-anchoring | [Threadmark](https://github.com/ccheney/threadmark) | MIT | `2fe268c3117abbc9d650a4f53e7b78cf1edc4e86` | Reference and selective adaptation | Rewritten as a one-store schema with new messages, imports, names, and tests. The notice is retained; the product no longer depends on Threadmark's thread, tag, settings, or side-panel model. |
| IndexedDB promise wrapper | [idb](https://github.com/jakearchibald/idb) | ISC | 8.x | Import | One replaceable persistence adapter in `src/background/database.ts`. |
| Text painting | [CSS Custom Highlight API](https://developer.mozilla.org/docs/Web/API/CSS_Custom_Highlight_API) | Web standard | Baseline 2025 | Platform API | A compatibility check contains the boundary; no page markup is wrapped or reparented. |
| Selection toolbar | Current live ChatGPT toolbar and `docs/design/sources/chatgpt-native-selection-toolbar.png` | Visual reference | Captured 2026-08 | Reference | Live classes and surface tokens are reused where available; a small fallback uses neutral tokens if ChatGPT changes its toolbar DOM. |
| Color palette | Current ChatGPT selection popover and `docs/design/sources/chatgpt-native-selection-toolbar-and-palette.png` | Visual reference | Captured 2026-08 | Reference | Private React components are unavailable to extensions, so a body-level toolbar reproduces only the required states. |
| Jump rail | Codex native rail and `docs/design/sources/codex-native-jump-rail.png` | Visual reference | Captured 2026-08 | Reference | Range-backed markers require a custom composition; the rail stores no data and can be removed without migration. |
| Cross-conversation Library | Current live ChatGPT Library Folders/Images lists, grids, tabs, controls and selection components | Runtime reference; not a licensed React component import | Audited 2026-09-12 | Runtime reuse and custom content composition | Keep the actual native header, search, tabs and toolbar controls. Discover current CSS-module names from loaded stylesheets and clone the full matching checkbox shell, input and sprite into extension-owned content. Reuse native row, selected-neighbor, column, grid and metadata classes. Synchronize the content container when the native responsive layout changes. No host JavaScript is copied or executed; no pinned private bundle or new dependency. The isolated adapter falls back to the observed utility markup when matching native components are absent and can be removed without a data migration. |
| Readable export | ChatGPT Library's primary-action placement and file download flow | Visual reference | Audited 2026-08-27 | Reference | Markdown, plain text, and JSON are generated locally from IndexedDB. No remote service, page scraping, or DOM completeness is required. |

## Component reuse gate

| Interactive region | Nearest mature/native candidate inspected | Why custom composition remains necessary |
| --- | --- | --- |
| Highlight action | ChatGPT's live selection-toolbar segment | No public component or extension insertion API exists. The extension copies the current button classes and measures the native divider at runtime. |
| Color and remove toolbar | ChatGPT's live text-selection popover | ChatGPT's internal component cannot be imported. The local toolbar uses its CSS tokens, density, focus behavior, and destructive-action order. |
| Highlight navigator | Codex jump rail, Threadmark side panel, generic browser scroll markers | Existing rails address messages or scroll percentage, not live CSS `Range` objects. The local rail renders every real highlight and adds keyboard labels and proximity magnification. |
| Library navigation and shell | Current Suggested/Folders/Images/All categories and the older All/Images/Documents layout | Reuse the live shell, native category states, controls and responsive container. The real filter, divider, grid and list nodes are not replaced. Native navigation keeps ownership of its data and restores managed attributes when Highlights exits. |
| Grouped highlight content | Live Folder/Image checkbox variants, selectable rows, responsive grids and native metadata | No public Library content-type API or importable private React component exists. Keep a thin conversation/record composition around the observed native components. List checkboxes use the full native 18px/4px shell, dark/light checked colors and hover bridge; grids use the separate 20px circular white/black-tick variant positioned 18px from the tile's bottom/right, outside its border layer. Row height, columns, hover opacity, 16px surface radius and adjacent-selection merging come from current native CSS classes, without overriding their appearance. Square grid tiles use native responsive 2–6 columns and 12/16px gaps, with metadata below. Compact lists follow the native selection visibility and secondary-date layout. Only local data, content labels, mixed grid state and event ownership are custom. |
| Export menu | ChatGPT Library New menu and download action | The native button class, inner wrapper, icon, ARIA menu state, and placement are cloned at runtime; only the visible label and action change. The local menu adds only extension-owned formats and exports the selected conversation/passages when a selection exists, otherwise the filtered result. |
| Backup and data controls | Browser extension options page conventions | The options page remains the narrow recovery/import/delete surface. Daily reading and export now live in Library because those are content actions, not settings. |

## Product entropy result

The shipping manifest has no `action`, `sidePanel`, `storage`, `activeTab`,
identity, network, or remote-code capability. The only page match is
`https://chatgpt.com/*`.
