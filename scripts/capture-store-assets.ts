import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
	CdpSession,
	createPageTarget,
	evaluate,
	interceptHtml,
	waitFor,
} from "../tests/e2e/cdp";

const cdpBaseUrl = process.env.HIGHLIGHTS_CDP_URL ?? "http://127.0.0.1:9333";
const outputDirectory = "assets/store";
const showcaseUrl = `https://chatgpt.com/c/highlights-store-${Date.now()}`;
const passages = [
	"A useful answer should be easy to return to.",
	"Mark the exact passage that matters without changing the conversation layout.",
	"Saved highlights return automatically when the conversation is reopened.",
	"The quiet edge rail takes you back in one click.",
] as const;

const showcaseHtml = `<!doctype html>
<html lang="en" class="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Highlights for ChatGPT showcase</title>
  <style>
    :root {
      --main-surface-primary: #fff;
      --text-primary: #0d0d0d;
      --text-secondary: #5d5d5d;
      --surface-hover: rgba(0,0,0,.05);
      --border-light: rgba(0,0,0,.11);
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; min-height: 100%; margin: 0; }
    body { overflow: hidden; background: #fff; color: #0d0d0d; font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .shell { display: grid; grid-template-columns: 252px 1fr; width: 100vw; height: 100vh; }
    aside { padding: 15px 12px; background: #f7f7f5; border-right: 1px solid rgba(0,0,0,.04); }
    .brand { display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 8px; font-weight: 600; letter-spacing: -.01em; }
    .brand-dot { width: 23px; height: 23px; border: 1px solid #1f1f1f; border-radius: 50%; }
    .new-chat { margin-top: 14px; padding: 9px 10px; border-radius: 8px; color: #292929; }
    .section { margin: 27px 10px 8px; color: #777; font-size: 12px; font-weight: 600; }
    .chat { overflow: hidden; margin: 2px 2px; padding: 8px 10px; border-radius: 8px; color: #3a3a3a; white-space: nowrap; text-overflow: ellipsis; }
    .chat.active { background: #eaeae7; color: #111; }
    .main { position: relative; overflow: hidden; }
    header { display: flex; align-items: center; justify-content: flex-end; height: 62px; padding: 0 30px; }
    .share { padding: 7px 13px; border: 1px solid rgba(0,0,0,.12); border-radius: 999px; background: #fff; font-weight: 500; }
    .conversation { width: min(760px, calc(100vw - 350px)); margin: 32px auto 0; }
    .user { width: fit-content; max-width: 520px; margin-left: auto; padding: 11px 16px; border-radius: 20px; background: #f2f2f2; }
    article { position: relative; margin-top: 44px; font-size: 18px; line-height: 1.72; letter-spacing: -.012em; }
    article h1 { margin: 0 0 48px; font-size: 25px; line-height: 1.2; letter-spacing: -.025em; }
    article p { margin: 0 0 17px; }
    article p.lead { margin-bottom: 70px; }
    article strong { font-weight: 620; }
    #native-toolbar {
      display: inline-flex;
      position: absolute;
      z-index: 20;
      left: 118px;
      top: 108px;
      overflow: hidden;
      border: 1px solid rgba(0,0,0,.14);
      border-radius: 13px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04);
    }
    #native-toolbar button { min-height: 40px; padding: 0 15px; border: 0; background: #fff; color: #151515; font: inherit; white-space: nowrap; }
    #native-toolbar button + button { border-left: 1px solid rgba(0,0,0,.12); }
    .composer { position: absolute; right: 50%; bottom: 30px; width: min(760px, calc(100vw - 350px)); height: 62px; transform: translateX(50%); border: 1px solid rgba(0,0,0,.12); border-radius: 24px; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
    .composer::before { content: "Ask anything"; position: absolute; left: 20px; top: 18px; color: #8a8a8a; }
    .composer::after { content: "↑"; position: absolute; right: 12px; top: 11px; display: grid; width: 38px; height: 38px; place-items: center; border-radius: 50%; background: #111; color: #fff; font-size: 20px; }
    .disclaimer { position: absolute; right: 50%; bottom: 7px; transform: translateX(50%); color: #929292; font-size: 11px; white-space: nowrap; }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="brand"><span class="brand-dot"></span><span>Chat</span></div>
      <div class="new-chat">＋&nbsp;&nbsp;New chat</div>
      <div class="section">Chats</div>
      <div class="chat active">Keeping useful ideas close</div>
      <div class="chat">A better reading workflow</div>
      <div class="chat">Notes from a long conversation</div>
    </aside>
    <main class="main">
      <header><button class="share">Share</button></header>
      <div class="conversation">
        <div class="user">How can I keep the useful parts of a long conversation?</div>
        <article data-message-author-role="assistant">
          <h1>Keep the answer, lose the hunting</h1>
          <p class="lead"><span id="passage-0"><strong>${passages[0]}</strong></span></p>
          <div id="native-toolbar" role="toolbar">
            <button type="button">Ask ChatGPT</button>
            <button type="button">Start writing</button>
          </div>
          <p><span id="passage-1">${passages[1]}</span> The page keeps its original spacing, hierarchy, and line breaks.</p>
          <p><span id="passage-2">${passages[2]}</span> There is no tag form, account, or separate dashboard to manage.</p>
          <p><span id="passage-3">${passages[3]}</span> It stays visible only when it has something useful to show.</p>
        </article>
      </div>
      <div class="composer"></div>
      <div class="disclaimer">Independent extension · Highlight data stays in this browser</div>
    </main>
  </div>
</body>
</html>`;

async function capture(session: CdpSession, filename: string) {
	const result = await session.send<{ data: string }>(
		"Page.captureScreenshot",
		{
			format: "png",
			fromSurface: true,
			captureBeyondViewport: false,
		},
	);
	await writeFile(
		`${outputDirectory}/${filename}`,
		Buffer.from(result.data, "base64"),
	);
}

async function selectPassage(session: CdpSession, index: number) {
	await evaluate(
		session,
		`(() => {
			const span = document.querySelector('#passage-${index}');
			if (!span) throw new Error('Passage ${index} is missing');
			const toolbar = document.querySelector('#native-toolbar');
			if (toolbar instanceof HTMLElement) toolbar.style.display = 'inline-flex';
			const range = document.createRange();
			range.selectNodeContents(span);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
			span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		})()`,
	);
	await waitFor(
		session,
		"Boolean(document.querySelector('#highlights-native-action'))",
		"the native Highlight action",
	);
}

async function createSelectedHighlight(session: CdpSession) {
	await evaluate(
		session,
		`(() => {
			const action = document.querySelector('#highlights-native-action');
			if (!(action instanceof HTMLButtonElement)) throw new Error('Highlight action is missing');
			action.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			action.click();
		})()`,
	);
}

await mkdir(outputDirectory, { recursive: true });

const target = await createPageTarget(cdpBaseUrl);
const session = new CdpSession(target.webSocketDebuggerUrl);
await session.ready;
interceptHtml(session, "https://chatgpt.com/", showcaseHtml);
await session.send("Page.enable");
await session.send("Runtime.enable");
await session.send("Fetch.enable", {
	patterns: [{ urlPattern: "https://chatgpt.com/*", requestStage: "Request" }],
});
await session.send("Emulation.setDeviceMetricsOverride", {
	width: 1280,
	height: 800,
	deviceScaleFactor: 1,
	mobile: false,
});
await session.send("Page.navigate", { url: showcaseUrl });
await waitFor(
	session,
	"document.readyState === 'complete' && Boolean(document.querySelector('#highlights-navigator'))",
	"the extension showcase",
);

await selectPassage(session, 0);
await capture(session, "01-highlight-where-you-read-1280x800.png");

await createSelectedHighlight(session);
await waitFor(
	session,
	"document.querySelectorAll('#highlights-navigator [data-highlight-id]').length === 1",
	"the first saved highlight",
);
await evaluate(
	session,
	"document.querySelector('#native-toolbar')?.setAttribute('style', 'display: none')",
);
await evaluate(
	session,
	`(() => {
		const span = document.querySelector('#passage-0');
		const range = document.createRange();
		range.selectNodeContents(span);
		const rect = range.getClientRects()[0];
		if (!rect) throw new Error('Highlighted passage has no client rect');
		span.dispatchEvent(new MouseEvent('click', {
			bubbles: true,
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2
		}));
	})()`,
);
await waitFor(
	session,
	"Boolean(document.querySelector('#highlights-color-palette'))",
	"the color palette",
);
await capture(session, "02-change-color-or-remove-1280x800.png");

await evaluate(
	session,
	"document.querySelector('#highlights-color-palette')?.remove()",
);
for (let index = 1; index < passages.length; index++) {
	await selectPassage(session, index);
	await createSelectedHighlight(session);
	await waitFor(
		session,
		`document.querySelectorAll('#highlights-navigator [data-highlight-id]').length === ${index + 1}`,
		`${index + 1} navigation markers`,
	);
	await evaluate(
		session,
		"document.querySelector('#native-toolbar')?.setAttribute('style', 'display: none')",
	);
}
await evaluate(
	session,
	`(() => {
		const rail = document.querySelector('.highlights-navigator-rail');
		const marker = document.querySelector('[data-highlight-index="2"]');
		if (!rail || !marker) throw new Error('Navigation rail is missing');
		const rect = marker.getBoundingClientRect();
		rail.dispatchEvent(new PointerEvent('pointermove', {
			bubbles: true,
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2
		}));
	})()`,
);
await waitFor(
	session,
	"!document.querySelector('#highlights-navigator-preview')?.hidden",
	"the navigation preview",
);
await capture(session, "03-return-instantly-1280x800.png");
session.close();

const icon = await readFile("assets/icons/icon-128.png");
const tileHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    html, body { width: 440px; height: 280px; margin: 0; }
    body { display: flex; align-items: center; padding: 38px; background: #f5f5f2; color: #111; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .card { width: 100%; padding: 26px 28px; border: 1px solid rgba(0,0,0,.09); border-radius: 22px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
    .top { display: flex; align-items: center; gap: 15px; }
    img { width: 54px; height: 54px; }
    h1 { margin: 0; font-size: 22px; line-height: 1.12; letter-spacing: -.025em; }
    p { margin: 14px 0 0; color: #595959; font-size: 14px; line-height: 1.45; }
    .accent { display: inline-block; height: 9px; margin-top: 17px; padding: 0 8px; border-radius: 5px; background: rgba(186,157,74,.29); color: transparent; }
  </style>
</head>
<body>
  <section class="card">
    <div class="top">
      <img src="data:image/png;base64,${icon.toString("base64")}" alt="">
      <h1>Highlights<br>for ChatGPT</h1>
    </div>
    <p>Mark what matters. Return in one click.<br>Your highlights stay in this browser.</p>
    <span class="accent">quiet highlight</span>
  </section>
</body>
</html>`;

const tileTarget = await createPageTarget(cdpBaseUrl);
const tileSession = new CdpSession(tileTarget.webSocketDebuggerUrl);
await tileSession.ready;
interceptHtml(tileSession, "https://chatgpt.com/", tileHtml);
await tileSession.send("Page.enable");
await tileSession.send("Fetch.enable", {
	patterns: [{ urlPattern: "https://chatgpt.com/*", requestStage: "Request" }],
});
await tileSession.send("Emulation.setDeviceMetricsOverride", {
	width: 440,
	height: 280,
	deviceScaleFactor: 1,
	mobile: false,
});
await tileSession.send("Page.navigate", {
	url: `https://chatgpt.com/highlights-store-tile-${Date.now()}`,
});
await waitFor(
	tileSession,
	"document.readyState === 'complete'",
	"the promo tile",
);
await capture(tileSession, "small-promo-tile-440x280.png");
tileSession.close();

console.log(`Created Chrome Web Store assets in ${outputDirectory}/`);
