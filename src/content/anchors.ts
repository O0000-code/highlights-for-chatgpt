export interface CapturedAnchor {
	text: string;
	prefix: string;
	suffix: string;
	occurrence?: number;
	range: Range;
}

export interface AnchorContext {
	prefix?: string;
	suffix?: string;
	occurrence?: number;
}

export interface RangeCandidate {
	range: Range;
	score: number;
	occurrence: number;
}

interface Boundary {
	node: Text;
	offset: number;
}

interface IndexedCharacter {
	start: Boundary;
	end: Boundary;
}

interface TextIndex {
	text: string;
	characters: IndexedCharacter[];
}

const EXCLUDED_TEXT_SELECTOR = [
	"[data-highlights-ui='true']",
	"script",
	"style",
	"noscript",
	"textarea",
	"input",
	"[contenteditable='true']",
].join(",");

export function captureSelectionAnchor(
	selection: Selection,
): CapturedAnchor | null {
	if (selection.rangeCount === 0 || selection.isCollapsed) return null;
	const sourceRange = selection.getRangeAt(0);
	const rawText = sourceRange.toString();
	const text = rawText.trim();
	if (!text) return null;

	const scope = getSelectionScope(sourceRange) ?? document.body;
	const prefixRange = document.createRange();
	const suffixRange = document.createRange();
	try {
		prefixRange.selectNodeContents(scope);
		prefixRange.setEnd(sourceRange.startContainer, sourceRange.startOffset);
		suffixRange.selectNodeContents(scope);
		suffixRange.setStart(sourceRange.endContainer, sourceRange.endOffset);
	} catch {
		return null;
	}

	const candidates = findRangeCandidates(scope, text, {});
	const occurrence = candidates.findIndex(({ range }) =>
		rangesShareBoundaries(range, sourceRange),
	);

	return {
		text,
		prefix: prefixRange.toString().slice(-160),
		suffix: suffixRange.toString().slice(0, 160),
		occurrence: occurrence >= 0 ? occurrence : undefined,
		range: sourceRange.cloneRange(),
	};
}

export function findBestRange(
	root: Node,
	text: string,
	context: AnchorContext = {},
	acceptRange: (range: Range) => boolean = () => true,
): Range | null {
	const candidates = findRangeCandidates(root, text, context).filter(
		({ range }) => acceptRange(range),
	);
	if (candidates.length === 0) return null;

	return (
		[...candidates]
			.sort((left, right) => {
				if (right.score !== left.score) return right.score - left.score;
				if (context.occurrence === left.occurrence) return -1;
				if (context.occurrence === right.occurrence) return 1;
				return left.occurrence - right.occurrence;
			})[0]
			?.range.cloneRange() ?? null
	);
}

export function findRangeCandidates(
	root: Node,
	text: string,
	context: AnchorContext = {},
): RangeCandidate[] {
	const exactText = text.trim();
	if (!exactText) return [];

	const exactIndex = buildTextIndex(root, false);
	const exactMatches = rangesFromIndex(exactIndex, exactText, context);
	if (exactMatches.length > 0) return exactMatches;

	const relaxedIndex = buildTextIndex(root, true);
	return rangesFromIndex(
		relaxedIndex,
		normalizeWhitespace(exactText),
		context,
		true,
	);
}

export function normalizeRangeText(value: string) {
	return normalizeWhitespace(value);
}

function getSelectionScope(range: Range) {
	const element =
		range.commonAncestorContainer instanceof Element
			? range.commonAncestorContainer
			: range.commonAncestorContainer.parentElement;
	return element?.closest<HTMLElement>("[data-message-author-role], article");
}

function buildTextIndex(root: Node, collapseWhitespace: boolean): TextIndex {
	const textNodes: Text[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			const parent = (node as Text).parentElement;
			return parent?.closest(EXCLUDED_TEXT_SELECTOR)
				? NodeFilter.FILTER_REJECT
				: NodeFilter.FILTER_ACCEPT;
		},
	});

	let current = walker.nextNode();
	while (current) {
		textNodes.push(current as Text);
		current = walker.nextNode();
	}

	let output = "";
	const characters: IndexedCharacter[] = [];
	for (const node of textNodes) {
		const value = node.nodeValue ?? "";
		for (let offset = 0; offset < value.length; offset++) {
			const character = value[offset];
			if (character === undefined) continue;
			const mapping = {
				start: { node, offset },
				end: { node, offset: offset + 1 },
			};

			if (!collapseWhitespace || !/\s/.test(character)) {
				output += character;
				characters.push(mapping);
				continue;
			}

			if (!output.endsWith(" ")) {
				output += " ";
				characters.push(mapping);
			} else {
				const previous = characters.at(-1);
				if (previous) previous.end = mapping.end;
			}
		}
	}

	return { text: output, characters };
}

function rangesFromIndex(
	index: TextIndex,
	searchText: string,
	context: AnchorContext,
	contextIsNormalized = false,
): RangeCandidate[] {
	const candidates: RangeCandidate[] = [];
	let searchFrom = 0;
	while (searchFrom <= index.text.length - searchText.length) {
		const matchIndex = index.text.indexOf(searchText, searchFrom);
		if (matchIndex < 0) break;
		const start = index.characters[matchIndex]?.start;
		const end = index.characters[matchIndex + searchText.length - 1]?.end;
		if (start && end) {
			const range = document.createRange();
			try {
				range.setStart(start.node, start.offset);
				range.setEnd(end.node, end.offset);
				const occurrence = candidates.length;
				candidates.push({
					range,
					occurrence,
					score:
						scoreContext(
							index.text,
							matchIndex,
							searchText,
							context,
							contextIsNormalized,
						) + (context.occurrence === occurrence ? 3 : 0),
				});
			} catch {
				// Ignore text nodes replaced during a concurrent ChatGPT render.
			}
		}
		searchFrom = matchIndex + Math.max(1, searchText.length);
	}
	return candidates;
}

function scoreContext(
	fullText: string,
	matchIndex: number,
	searchText: string,
	context: AnchorContext,
	normalize: boolean,
) {
	const prefix = normalize
		? normalizeWhitespace(context.prefix ?? "")
		: (context.prefix ?? "");
	const suffix = normalize
		? normalizeWhitespace(context.suffix ?? "")
		: (context.suffix ?? "");
	const before = fullText.slice(Math.max(0, matchIndex - 160), matchIndex);
	const after = fullText.slice(
		matchIndex + searchText.length,
		matchIndex + searchText.length + 160,
	);
	return (
		matchingSuffixLength(prefix, before) + matchingPrefixLength(suffix, after)
	);
}

function matchingSuffixLength(left: string, right: string) {
	let length = 0;
	const maximum = Math.min(left.length, right.length, 160);
	while (
		length < maximum &&
		left[left.length - 1 - length] === right[right.length - 1 - length]
	) {
		length++;
	}
	return length;
}

function matchingPrefixLength(left: string, right: string) {
	let length = 0;
	const maximum = Math.min(left.length, right.length, 160);
	while (length < maximum && left[length] === right[length]) length++;
	return length;
}

function normalizeWhitespace(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

function rangesShareBoundaries(left: Range, right: Range) {
	return (
		left.startContainer === right.startContainer &&
		left.startOffset === right.startOffset &&
		left.endContainer === right.endContainer &&
		left.endOffset === right.endOffset
	);
}
