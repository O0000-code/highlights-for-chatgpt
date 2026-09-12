# Product scope

## Single purpose

Help a person mark useful passages inside ChatGPT conversations and return to
those exact passages later, without modifying ChatGPT's message DOM.

## Version 0.3

In:

- ChatGPT selection-toolbar action with a native separator.
- Non-destructive CSS Custom Highlight painting.
- Automatic conversation-scoped restoration.
- Four restrained colors and a rightmost Remove action.
- One real edge-rail marker per highlight, including the one-highlight state.
- Proximity-weighted magnetic expansion, preview, click-to-jump, keyboard focus,
  and reduced-motion behavior.
- Local IndexedDB, backup, compatible legacy import, and delete-all recovery
  controls.
- **Highlights** as a fourth content type inside ChatGPT's existing Library.
- Conversation-first list/grid views with search, color filtering, readable
  preview, and exact jump-back.
- Conversation-level and passage-level selection for scoped Markdown,
  plain-text, and JSON export directly from local IndexedDB.
- Allow-listed, local extension-to-extension interoperability that preserves
  current-conversation highlight text and color in ChatGPT Exporter's Markdown
  output without exposing records to page scripts.
- Explicit deep-link recovery that progressively loads older virtualized
  messages only when an exact source jump requires it.

Out:

- Popup, side panel, tags, notes, AI suggestions, accounts, sync, analytics,
  custom themes, dashboards, engagement features, or remote code.
- Direct dependencies on ChatGPT's private React internals.

## Library design decision

Cross-conversation reading and export proved to be a frequent task the edge rail
cannot solve. Highlights therefore extends ChatGPT's existing Library instead
of adding a popup, side panel, or separate dashboard. ChatGPT's real heading,
search, tabs, toolbar, spacing, and responsive container remain in control; the
extension replaces only the content below the toolbar while Highlights is
active. Conversations are the primary objects, with passages nested beneath
them. A conversation checkbox is the one-step path for exporting one complete
conversation; passage checkboxes support narrower selections. Context and
source actions are progressively revealed in preview. Tags, analytics, and
configuration remain out of scope.
