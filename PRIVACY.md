# Privacy policy for Highlights for ChatGPT

Effective date: September 11, 2026

Highlights for ChatGPT is a local-only browser extension for saving and restoring text
highlights on `chatgpt.com`.

## Data the extension handles

When the user creates a highlight, the extension stores:

- the selected text;
- a short amount of surrounding text used only to find the same passage again;
- the ChatGPT conversation URL and conversation identifier;
- the conversation title shown in ChatGPT, when available;
- the selected highlight color; and
- creation and update timestamps.

This is website content and user-generated content under Chrome Web Store data
disclosure definitions. Because the matching conversation URL is stored, the
extension also handles web-browsing activity locally for this single feature.

## How data is used

The data is used only to restore highlights in the matching ChatGPT
conversation, change their color, remove them, navigate between them, browse
them in the local Library, and create readable exports or import a backup at
the user's request. When the user has installed the explicitly compatible local
ChatGPT Exporter extension, the data can also be used to preserve current-page
highlight text and color in a Markdown export.

## Storage and transmission

All highlight data is stored locally in extension-owned IndexedDB in the
user's browser. Highlights for ChatGPT does not operate a server and does not
transmit highlight data, conversation content, browsing history, identifiers,
or usage events over the network.

For the optional Markdown interoperability feature, Chrome permits only the
allow-listed ChatGPT Exporter extension ID to open a direct extension-to-extension
connection. On a matching `chatgpt.com/c/...` page, Highlights for ChatGPT can
provide that extension with the current conversation's selected text, short
anchor context, color, occurrence index, local record identifier, and
timestamps. Conversation titles and URLs are not included in the returned
records. Web pages cannot open this connection, and the data is not transported
through page events. The compatible exporter uses these fields locally to add
inline `<mark>` annotations to Markdown selected by the user for export.

The extension contains no analytics, advertising, tracking, account system,
remote code, AI service, telemetry, or cloud synchronization.

The extension's use of information is limited to the user-facing highlighting
features described here and complies with the Chrome Web Store User Data
Policy, including its Limited Use requirements. No developer or other human can
access locally stored highlight data through the extension.

## Site access

The extension runs only on `https://chatgpt.com/*`. It reads page text only to:

1. capture a passage the user explicitly selects;
2. find and repaint previously saved passages; and
3. label a saved passage with its conversation title; and
4. navigate back to a saved passage, progressively loading older messages only
   when the user explicitly opens that source highlight.

It does not access other sites.

## Retention and user control

Data remains on the device until the user removes an individual highlight,
uses **Delete all highlights** in Extension options, clears browser extension
data, or uninstalls the extension. The Library can export Markdown, plain text,
or a JSON backup; the options page can import compatible backups.

## Data sale and disclosure

Highlights for ChatGPT does not sell or rent user data. Other than the explicit
local Markdown interoperability described above, it does not share or disclose
user data. It does not use data for creditworthiness, lending, advertising,
profiling, or any purpose unrelated to the extension's single purpose.

## Children

The extension is not directed to children and does not knowingly collect or
transmit personal information.

## Changes

Material changes to this policy will be reflected in the extension's release
notes and the effective date above.

## Contact

For privacy questions, support, or bug reports, open an issue at:

https://github.com/O0000-code/highlights-for-chatgpt/issues

Issues are public. Do not include ChatGPT conversation content, exported
highlight backups, credentials, or other personal data. The developer cannot
access locally stored highlights through the extension.
