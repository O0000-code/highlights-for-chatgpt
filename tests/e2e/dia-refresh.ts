import {
	CdpSession,
	createPageTarget,
	evaluate,
	interceptHtml,
	waitFor,
} from "./cdp";

const cdpBaseUrl = process.env.HIGHLIGHTS_CDP_URL ?? "http://127.0.0.1:9333";
const fixtureUrl = `https://chatgpt.com/c/highlights-dia-e2e-${Date.now()}`;
const fixtureText = "真实刷新后仍然应该恢复的高亮文本。";
const fixtureHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Highlights Dia refresh fixture</title>
  <style>
    body { margin: 0; padding: 80px; font: 16px/1.6 -apple-system, sans-serif; }
    article { width: 680px; }
    #native-toolbar { display: inline-flex; margin-top: 20px; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; }
    #native-toolbar button { padding: 10px 16px; border: 0; background: white; }
  </style>
</head>
<body>
  <main>
    <div id="conversation-shell" aria-busy="true"></div>
  </main>
  <script>
    window.setTimeout(() => {
      document.querySelector('#conversation-shell').innerHTML = \`
        <article data-message-author-role="assistant">
          <p id="answer">在这个隔离页面中，${fixtureText} 这段文字用于验证完整生命周期。</p>
        </article>
        <div id="native-toolbar" role="toolbar">
          <button type="button">Ask ChatGPT</button>
          <button type="button">Start writing</button>
        </div>
      \`;
      document.querySelector('#conversation-shell').removeAttribute('aria-busy');
    }, 700);
  </script>
</body>
</html>`;

const target = await createPageTarget(cdpBaseUrl);
const session = new CdpSession(target.webSocketDebuggerUrl);
await session.ready;

interceptHtml(session, "https://chatgpt.com/", fixtureHtml);

await session.send("Page.enable");
await session.send("Runtime.enable");
await session.send("Fetch.enable", {
	patterns: [{ urlPattern: "https://chatgpt.com/*", requestStage: "Request" }],
});
await session.send("Page.navigate", { url: fixtureUrl });

await waitFor(
	session,
	"document.readyState === 'complete' && Boolean(document.querySelector('#highlights-navigator'))",
	"the Highlights content script",
);
await waitFor(
	session,
	"Boolean(document.querySelector('#answer'))",
	"the delayed ChatGPT conversation body",
);

await evaluate(
	session,
	`(() => {
		const paragraph = document.querySelector('#answer');
		const node = paragraph?.firstChild;
		if (!(node instanceof Text)) throw new Error('Fixture text is missing');
		const start = node.data.indexOf(${JSON.stringify(fixtureText)});
		const range = document.createRange();
		range.setStart(node, start);
		range.setEnd(node, start + ${fixtureText.length});
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		paragraph.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	})()`,
);

await waitFor(
	session,
	"Boolean(document.querySelector('#highlights-native-action'))",
	"the native Highlight action",
);
await evaluate(
	session,
	`(() => {
		const action = document.querySelector('#highlights-native-action');
		if (!(action instanceof HTMLButtonElement)) throw new Error('Highlight action is missing');
		action.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		action.click();
	})()`,
);

const markerSelector =
	"#highlights-navigator .highlights-fallback-marker, [data-highlights-native-marker]";
const markerExpression = `document.querySelectorAll(${JSON.stringify(markerSelector)}).length === 1 && !document.querySelector('#highlights-navigator')?.hidden`;
await waitFor(session, markerExpression, "the first navigation marker");

const beforeRefresh = await evaluate<Record<string, unknown>>(
	session,
	`({
		markerCount: document.querySelectorAll(${JSON.stringify(markerSelector)}).length,
		navigatorHidden: document.querySelector('#highlights-navigator')?.hidden,
		paintStylePresent: Boolean(document.querySelector('#highlights-native-paint-style'))
	})`,
);

await session.send("Page.reload", { ignoreCache: true });
await waitFor(
	session,
	"document.readyState === 'complete' && Boolean(document.querySelector('#highlights-navigator'))",
	"the content script after refresh",
);
await waitFor(
	session,
	markerExpression,
	"the restored navigation marker",
	35_000,
);

const afterRefresh = await evaluate<Record<string, unknown>>(
	session,
	`({
		markerCount: document.querySelectorAll(${JSON.stringify(markerSelector)}).length,
		navigatorHidden: document.querySelector('#highlights-navigator')?.hidden,
		paintStylePresent: Boolean(document.querySelector('#highlights-native-paint-style')),
		selectedTextStillPresent: document.body.innerText.includes(${JSON.stringify(fixtureText)})
	})`,
);

console.log(JSON.stringify({ beforeRefresh, afterRefresh }, null, 2));
session.close();
