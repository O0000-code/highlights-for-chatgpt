# ChatGPT refresh compatibility — 0.3.10

The October 2026 ChatGPT interface replaced classic conversation articles with
semantic selection/search hooks and redirected the Library route to Space.
Version 0.3.10 restores the existing highlight workflow without changing storage,
extension identity, permissions, or message markup.

- Centralize classic/refreshed message and user-prompt recognition. Use the same
  hooks for selection capture, navigation ordering, and long-conversation loading.
- Support the Space All surface and its nested native tab wrappers, preserving
  the host route and native content when entering or leaving Highlights.
- Reuse Space's role-checkbox classes, row surface, grid tile and responsive
  masonry column classes. Keep list and grid checkbox geometry independent.
- Read the refreshed theme colors for the palette, navigation preview and Library.
- Ignore hidden cached text and plaintext composers when restoring saved ranges.

## Verification

Biome, TypeScript, 86 unit/DOM tests and the extension build passed. Synthetic
regressions cover the new message hooks, plain user prompts, nested Space tabs,
classic compatibility, hidden duplicates and cold-grid checkbox separation.

Signed-in Dia checks covered native Highlight insertion, saving, cold refresh,
all four colors, navigation, Space cold entry, search, list/grid switching,
selection, detail Back/Escape, and an actual selected Markdown download.
The downloaded file contained exactly one selected passage and its blue color
metadata. Existing records remained available throughout the update.

The measured grid columns and 16px gap matched the native grid in the same
viewport. List controls measured 16px with a 2px radius; grid controls measured
20px with a circular radius. Painted message HTML remained unchanged.

No signed-in conversation content, browser profile, downloaded personal export,
or real-page screenshot is included in the source repository or release package.
These checks cover this host revision and the tested paths; future ChatGPT DOM
changes may require another compatibility update.

## Selection-state corrections — 0.3.11

The follow-up review found gaps in the cold-grid fallback and partial-selection
matrix. List controls now have an independent transparent fallback instead of
borrowing the grid's white surface. Cached classic row/column classes are not
combined with Space components. Checkbox visibility is scoped to its own
hovered/focused row, with selected and mixed controls retained.

Only selected passages and fully selected conversations receive selection fill;
the summary remains neutral and a partially selected conversation is indicated
by its mixed checkbox. Native view controls synchronize both their style tokens
and the refreshed `data-selected` / `data-suppress-active-style` attributes with
the displayed content, restoring the original nodes and attributes on exit.

The automated matrix now includes 91 tests covering these regressions.

Signed-in follow-up checks confirmed a transparent, initially hidden list
checkbox with an 8px gutter between its right edge and the row surface. With
one passage selected, the summary and partially selected conversation remained
transparent while the passage received the native 5% neutral fill. List/grid
round-trips retained the selection and matched the displayed content to the
native selected flags and button-surface opacity.

## Native state matrix — 0.3.12

The 0.3.11 review was withdrawn. The 0.3.12 build was verified locally and its
visual result was confirmed by the user on 2026-10-03. Store submission is tracked
in the release checklist.

- Build Space checkboxes as controlled native buttons, not styled browser inputs.
  Reuse the matching native button presentation and check/mixed SVGs, excluding
  file identifiers and labels. Upgrade late-arriving templates in place, keeping
  selection and keyboard focus. Route dock and bridge clicks through one toggle.
- Put the statistics label and selection actions in a 42px flex header with the
  native 8px horizontal inset. The checkbox lives in its separate left gutter:
  measured size 16px, radius 2px, and 16px clear space before the statistics text.
- Keep statistics and conversation metadata neutral, including full selection.
  Selected passage rows use the native active neutral surface (`#f3f3f3` in the
  inspected light theme). Merge adjoining selected corners only inside one
  conversation and hide their internal dividers.
- Use the named `library-row` content container for the native 32rem date-column
  threshold. Below it, omit dates and reserve the native 36px action column;
  above it, use the 160px date and 64px action columns. Do not borrow the classic
  Library's viewport-based secondary-date layout for Space.
- Insert an explicit 1px vertical separator in the selection toolbar, with a
  visible native border token. Reject transparent button borders as separator
  references and keep native button attributes and label wrappers.

Signed-in Dia checks on 2026-10-02 covered initially hidden controls, own-row
reveal, partial selection, adjoining selected rows, select all, Clear, list/grid
round-trips, detail Back, and cold refresh with the existing records intact.
Actual text selection displayed Ask ChatGPT and Highlight at equal height with
the visible divider between them. No test passage was added or deleted.

Desktop-type responsive checks measured a 449.5px row container at an 820px
viewport: the date column was hidden, text remained 14px, and the 16px/2px
checkbox dock remained available. Back at a 1532px viewport, the 1161.5px row
container restored the 160px date and 64px action columns. Preview settings and
the original native grid preference were restored; diagnostic panels were closed.

Biome, TypeScript, 94 unit/DOM tests (673 assertions), build, package integrity,
and deployed-file comparison passed. Regression coverage includes singleton
Ask menus with transparent borders, delayed native hydration and focused-control
reparenting, single-toggle dock activation, and compact Space selection.

This is a bounded check of the reported states, not a claim that every host UI
variant or future ChatGPT update is covered. The host's blocked telemetry
requests also remain visible in its console; this pass does not diagnose them.
Visual confirmation was received on 2026-10-03.
