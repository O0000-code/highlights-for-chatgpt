import { describe, expect, test } from "bun:test";
import { HighlightRecoveryScheduler } from "../../src/content/recovery";

describe("highlight recovery scheduling", () => {
	test("reconciles immediately and across delayed ChatGPT renders", () => {
		let reconciliations = 0;
		let nextHandle = 0;
		const callbacks = new Map<number, () => void>();
		const scheduler = new HighlightRecoveryScheduler(
			() => reconciliations++,
			(callback) => {
				nextHandle++;
				callbacks.set(nextHandle, callback);
				return nextHandle as unknown as ReturnType<typeof setTimeout>;
			},
			(handle) => callbacks.delete(handle as unknown as number),
		);

		scheduler.start([100, 500]);
		expect(reconciliations).toBe(1);
		for (const callback of [...callbacks.values()]) callback();
		expect(reconciliations).toBe(3);
	});

	test("cancels stale retries when the conversation changes", () => {
		let reconciliations = 0;
		let nextHandle = 0;
		const callbacks = new Map<number, () => void>();
		const scheduler = new HighlightRecoveryScheduler(
			() => reconciliations++,
			(callback) => {
				nextHandle++;
				callbacks.set(nextHandle, callback);
				return nextHandle as unknown as ReturnType<typeof setTimeout>;
			},
			(handle) => callbacks.delete(handle as unknown as number),
		);

		scheduler.start([100, 500]);
		scheduler.stop();
		for (const callback of [...callbacks.values()]) callback();
		expect(reconciliations).toBe(1);
		expect(callbacks.size).toBe(0);
	});

	test("debounces repeated DOM mutations into one recovery pass", () => {
		let reconciliations = 0;
		let nextHandle = 0;
		const callbacks = new Map<number, () => void>();
		const scheduler = new HighlightRecoveryScheduler(
			() => reconciliations++,
			(callback) => {
				nextHandle++;
				callbacks.set(nextHandle, callback);
				return nextHandle as unknown as ReturnType<typeof setTimeout>;
			},
			(handle) => callbacks.delete(handle as unknown as number),
		);

		scheduler.request(100);
		scheduler.request(100);
		scheduler.request(100);
		expect(callbacks.size).toBe(1);
		callbacks.values().next().value?.();
		expect(reconciliations).toBe(1);
	});

	test("calls browser timer functions without an illegal method receiver", () => {
		let nextHandle = 0;
		const callbacks = new Map<number, () => void>();
		function receiverSensitiveTimer(
			this: unknown,
			callback: () => void,
		): ReturnType<typeof setTimeout> {
			if (this !== undefined) throw new TypeError("Illegal invocation");
			nextHandle++;
			callbacks.set(nextHandle, callback);
			return nextHandle as unknown as ReturnType<typeof setTimeout>;
		}
		function receiverSensitiveClear(this: unknown, handle: TimerHandle) {
			if (this !== undefined) throw new TypeError("Illegal invocation");
			callbacks.delete(handle as unknown as number);
		}

		const scheduler = new HighlightRecoveryScheduler(
			() => undefined,
			receiverSensitiveTimer,
			receiverSensitiveClear,
		);
		expect(() => scheduler.request(100)).not.toThrow();
		expect(callbacks.size).toBe(1);
		expect(() => scheduler.stop()).not.toThrow();
	});
});

type TimerHandle = ReturnType<typeof setTimeout>;
