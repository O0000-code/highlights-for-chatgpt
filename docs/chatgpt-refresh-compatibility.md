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
