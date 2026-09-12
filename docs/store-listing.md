# Chrome Web Store listing draft

## Product details

Name: **Highlights for ChatGPT**

Summary (132 characters maximum):

> Highlight useful ChatGPT passages, restore them automatically, and jump back instantly. Local-only and distraction-free.

Category: **Productivity**

Language: English for the first listing. The in-page action also localizes to
Chinese when ChatGPT's document language is Chinese.

## Detailed description

Long ChatGPT conversations are useful until the passage you need disappears
inside them. Highlights for ChatGPT adds a quiet, native-feeling way to mark
exact passages, find them again, and take the useful parts with you.

Select text and choose **Highlight** beside ChatGPT's existing selection actions.
Your highlight returns automatically whenever you reopen that conversation. A
compact edge rail shows one real marker for every saved passage; hover to preview
and click to jump.

Open **Highlights** in ChatGPT's Library to browse everything you have marked,
search or filter by color, preview a passage, and return to its exact source.
Export all, filtered, or selected highlights as Markdown or plain text, or keep
a JSON backup that can be restored later.

You can:

- create a highlight in one click;
- switch between four restrained colors;
- remove a highlight from the same compact toolbar;
- jump between saved passages without a sidebar or popup;
- browse, search, filter, and preview highlights in ChatGPT's Library;
- export selected highlights as Markdown or plain text; and
- create and restore a portable JSON backup.

Highlights for ChatGPT never wraps or rewrites ChatGPT message content. It uses the browser's
CSS Custom Highlight API, so the page hierarchy and line layout remain intact.

Privacy by design:

- local browser storage only;
- no account or cloud service;
- no analytics, advertising, tracking, or telemetry;
- no AI processing of saved text;
- no remote code; and
- access limited to chatgpt.com.

If the compatible ChatGPT Exporter extension is also installed, highlights from
the current conversation can be included in its Markdown export. That optional
connection is restricted to the allow-listed extension and stays inside the
browser; it does not use a website or network service.

Highlights for ChatGPT is an independent project and is not affiliated with, endorsed by, or
sponsored by OpenAI. ChatGPT is a trademark of OpenAI.

## Permission and site-access rationale

The extension declares no optional Chrome permissions. Its static content script
runs only on `https://chatgpt.com/*` so it can read the passage the user selects,
find saved passages after page rendering, and draw the local highlight and jump
controls. It does not access other websites or make network requests.

## Privacy disclosure answers

Data categories to select in the Chrome Web Store form:

- Personal communications: a selected passage can be part of a private ChatGPT
  conversation; it is handled locally only and never transmitted.
- Web history: the matching ChatGPT conversation
  URL is stored as the record's association key and is never transmitted.
- Website content: selected ChatGPT passage, short surrounding anchor text,
  conversation title when available, color, and timestamps.

Do not select personally identifiable information, health information,
financial/payment information, authentication information, location, or user
activity. The extension does not monitor clicks, pointer position, scrolling,
keystrokes, or general browsing behavior.

Certification:

- Data is used only for the extension's single purpose.
- Data is not sold, transferred, or used for advertising, creditworthiness, or
  unrelated purposes.
- Data remains local and is never transmitted to the developer or a third party.
- No developer or other human can access locally stored highlight data through
  the extension.

## Asset captions

1. `assets/store/01-highlight-where-you-read-1280x800.png` — **Highlight where
   you read**: the action joins ChatGPT's selection toolbar.
2. `assets/store/02-change-color-or-remove-1280x800.png` — **Change color or
   remove**: four quiet colors and one explicit Remove action.
3. `assets/store/03-return-instantly-1280x800.png` — **Return instantly**: one
   compact marker for every saved passage.
4. `assets/store/small-promo-tile-440x280.png` — required small promotional
   tile, using only the extension's own icon and identity.

## Submission placeholders

- Proposed public repository: `https://github.com/O0000-code/highlights-for-chatgpt`.
- Proposed privacy policy URL: `https://github.com/O0000-code/highlights-for-chatgpt/blob/main/PRIVACY.md`.
- Proposed support URL: `https://github.com/O0000-code/highlights-for-chatgpt/issues`.
- Publisher contact email: add in the developer dashboard; do not commit a private address.

## Privacy review fields

Single purpose:

> Let users save, restore, organize, navigate to, and export text highlights
> from ChatGPT conversations, entirely in their browser.

Host permission justification:

> The extension runs only on https://chatgpt.com/* so it can capture text the
> user explicitly selects, identify the current conversation, restore saved
> ranges after ChatGPT renders, and add the highlight, navigation, Library, and
> export interfaces. It does not access any other site or send network requests.

Remote code: **No**.

Distribution: **Free**, **Public**, **All regions**, no in-app purchases.
