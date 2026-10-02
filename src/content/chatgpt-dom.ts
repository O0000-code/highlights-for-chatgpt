/** Stable semantic hooks across ChatGPT's classic and refreshed conversation UI. */
export const MESSAGE_SELECTOR = [
	"[data-chatgpt-selection-message-id]",
	"[data-chatgpt-search-unit-key$=':user']",
	"[data-message-author-role]",
	"[data-markdown-text-style='assistant-message']",
	"[data-markdown-text-style='user-message']",
	"article",
].join(",");

export function getMessageElement(node: Node | null) {
	const element = node instanceof Element ? node : node?.parentElement;
	return element?.closest<HTMLElement>(MESSAGE_SELECTOR) ?? null;
}

export function getPromptElements() {
	return Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR))
		.filter((element) => {
			if (
				element.closest("[data-highlights-ui], [hidden], [aria-hidden='true']")
			)
				return false;
			return (
				element
					.getAttribute("data-chatgpt-search-unit-key")
					?.endsWith(":user") ||
				element.getAttribute("data-message-author-role") === "user" ||
				element.getAttribute("data-markdown-text-style") === "user-message" ||
				Boolean(
					element.querySelector("[data-markdown-text-style='user-message']"),
				)
			);
		})
		.filter(
			(element, _index, all) =>
				!all.some((other) => other !== element && other.contains(element)),
		);
}
