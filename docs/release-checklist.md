# Release checklist

## Automated gates

- [x] `bun install --frozen-lockfile`
- [x] `bun run check`
- [x] `bun run typecheck`
- [x] `bun run test`
- [x] `bun run build`
- [x] `bun run package`
- [x] ZIP contains only runtime JavaScript, options HTML, manifest, four icons,
  and the required license notices.
- [x] Flat highlight icon is legible at 16/32/48/128px, uses the required
  transparent 128px canvas, and is reflected in the 440x280 promotional tile.
- [x] No remote script, dynamic code, or unexpected permission.
- [x] Forbidden-brand scan contains only migration, attribution, and independence disclosures.

## Functional browser matrix

- [x] Create, restore, recolor, remove, and jump on a real ChatGPT conversation.
- [x] One highlight produces one visible rail marker.
- [ ] 20 and 100 highlights remain usable without expanding outside the viewport.
- [ ] Plain text, nested emphasis, list item, code, table, CJK, duplicate text, and
  multi-paragraph selection.
- [ ] ChatGPT streaming, regenerate, edit, lazy load, route change, reload, back,
  and forward navigation.
- [x] Reload and delayed hydration restore saved highlights and the navigation rail.
- [x] Library inserts Highlights beside the current Suggested/Folders/Images/All
  categories (and supports the older All/Images/Documents layout) without
  modifying or replacing the official Library DOM.
- [x] Library list, conversation-title hydration, search, detail preview, and
  return to the native All tab on a real signed-in ChatGPT Library.
- [x] Library keeps one native tab row, restores All/Images/Documents without
  stale `view=highlights` state, and does not shift or cover the page shell.
- [x] Library reuses the exact live filter/grid/list button nodes and divider;
  labels, children, classes, 36px circles, list/grid state, and teardown
  restoration are locked by DOM identity tests and measured in signed-in Dia.
- [x] Highlights and Export preserve the native inner wrappers, active/inactive
  classes, primary-button icon, and menu-state attributes.
- [x] Current native important background utilities keep exactly one category
  selected; rapid re-entry preserves router state without stale URL cleanup.
- [x] Search/selection export scope stays current while menus are open; Escape,
  outside clicks and native header replacement dispose popovers correctly.
- [x] Focus/pageshow refresh records without dropping active query or selection.
- [x] Conversation grouping, group/passages checkboxes, selected-count state,
  and selected-only export are verified in a real signed-in Library.
- [x] List rows reuse the live 18px/4px checkbox and native hover/selection
  surfaces; measured desktop row geometry matches the official Folder list.
- [x] Grid cards reuse the separate native 20px circular checkbox, white checked
  fill, black tick and 18px bottom/right inset outside the bordered tile.
- [x] Wide → narrow → wide native container changes keep the correct gutters,
  compact secondary dates and selection state; list/grid visibility is isolated.
- [x] Selection controls reveal only for the hovered conversation or highlight;
  checked and indeterminate controls remain visible without exposing every empty checkbox.
- [x] Detail preview has an explicit Back control plus Escape-key return to the list.
- [x] Markdown, plain-text, and JSON export serializers cover every local record
  independently of conversation DOM hydration.
- [x] Compatible ChatGPT Exporter access is restricted to its exact extension
  ID, the same ChatGPT conversation, and the minimum annotation fields.
- [ ] Real Dia Markdown export preserves yellow, green, blue, and pink marks;
  excluded messages stay excluded and disabling either extension degrades safely.
- [x] A signed-in browser export preserved stored annotations as structure-safe
  `<mark>` segments around Markdown blockquotes and emphasis.
- [x] A signed-in Library export produced readable Markdown grouped by
  conversation with source links.
- [x] A cold Library deep link progressively loaded a long conversation,
  rejected non-visible duplicate ranges, and centered the intended passage.
- [x] No message wrapper, text-node split, line break, content crash, or console error
  in the verified create/restore/recolor/remove/jump/reload paths.
- [ ] Light and dark themes.
- [x] 100%, 125%, 150%, and 200% browser zoom.
- [x] Narrow and wide desktop widths.
- [ ] Keyboard focus, Escape dismissal, and reduced motion.
- [ ] Options export, current import, legacy import, invalid import, cancel delete,
  and confirmed delete.

## Store submission

- [x] Replace the privacy-policy Contact placeholder with public support details.
- [x] Publish the privacy policy at a stable HTTPS URL.
- [x] Verify the publisher's public contact email.
- [x] Pay the Chrome Web Store one-time registration fee.
- [x] Upload `releases/highlights-for-chatgpt-v0.3.8.zip` as a new draft item.
- [x] Upload `releases/highlights-for-chatgpt-v0.3.9.zip` to the existing draft.
- [x] Prepare three sanitized 1280×800 screenshots and the 440×280 promotional tile.
- [x] Upload the prepared screenshots and promotional tile.
- [x] Disclose website content, personal communications, and matching
  conversation URLs as locally handled data; do not claim user-activity tracking.
- [x] Confirm single-purpose and site-access rationales.
- [x] Confirm the listing says the extension is independent and not affiliated with OpenAI.
- [x] Submit version 0.3.9 for review with automatic publication after approval.

## Refreshed ChatGPT update — 0.3.10

- [x] Restore the native Highlight action on refreshed messages and plain user prompts.
- [x] Restore Highlights in Space while retaining classic Library compatibility.
- [x] Verify native list/grid geometry, selection, search, Back/Escape, and selected export.
- [x] Verify save, cold refresh, four colors, jump-back and removal in signed-in Dia.
- [x] Verify 86 tests, formatting, typecheck, build, ZIP integrity and public-source privacy.
- [x] Publish the source fix and reproduce the packaged build from the public checkout.
- [x] Complete the publisher's Google reauthentication.
- [x] Upload version 0.3.10 to the existing store item.
- [x] Supersede the 0.3.10 draft before submission; use 0.3.11.

Version 0.3.10 was not submitted: follow-up selection-state regressions were
fixed before review, and its draft package was replaced with 0.3.11.

## Selection-state follow-up — 0.3.11

- [x] Keep cold-grid fallback styles separate from list checkboxes.
- [x] Isolate Space rows from cached classic Library surfaces.
- [x] Keep the summary and partially selected conversation neutral.
- [x] Synchronize native view-control classes and selection flags with content.
- [x] Verify 91 tests, formatting, typecheck, build and ZIP integrity.
- [x] Verify the reported partial-selection and view-switch states in signed-in Dia.
- [x] Upload version 0.3.11 to the existing store item.
- [x] Replace the policy link with its directly accessible public content URL.
- [x] Withdraw the 0.3.11 review after further reported visual regressions.
- [x] Obtain the user's visual confirmation before another store submission.

## Native state matrix candidate — 0.3.12

- [x] Replace simulated Space inputs with controlled native checkbox buttons.
- [x] Preserve state and focus as native checkbox templates arrive late.
- [x] Separate statistics, checkbox gutter, and selection actions without overlap.
- [x] Keep metadata neutral and merge only adjacent selected passages.
- [x] Match the Space content-container date threshold and action-column widths.
- [x] Verify an actual visible separator in the native text-selection toolbar.
- [x] Pass 94 tests, formatter, typecheck, build, package integrity, and deployment comparison.
- [x] Install into the existing unpacked identity and verify wide and compact desktop states in Dia.
- [x] Obtain the user's confirmation of the locally installed candidate on 2026-10-03.
- [x] Publish the final approved source and upload its matching package.
- [x] Submit the approved update to the existing store item.

Version 0.3.12 was submitted on 2026-10-03. The dashboard confirmed receipt and
shows the update awaiting review, with automatic publication after approval.
The existing approved release remains available during review.

- Runtime source commit: `ad1a84a8f3cbab8b10048e19f80baa39ee47380c`.
- Uploaded ZIP SHA-256: `7d8c1bf264cea9837d70b65adc25f4190a1bc52ebd42dbf04697a1b44220753c`.
- Independent privacy review: passed; no private conversation data, credentials,
  browser profile files, or local paths in the submitted package.
- [ ] Confirm store approval and public availability of 0.3.12.
