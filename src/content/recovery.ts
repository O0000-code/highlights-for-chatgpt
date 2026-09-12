export const DEFAULT_RECOVERY_DELAYS = [
	160, 420, 900, 1800, 3600, 7200, 15000, 30000,
] as const;

type TimerHandle = ReturnType<typeof setTimeout>;
type SetTimer = (callback: () => void, delay: number) => TimerHandle;
type ClearTimer = (handle: TimerHandle) => void;

/**
 * Reconciles saved ranges while ChatGPT streams, hydrates, virtualizes, or
 * replaces message DOM. Starting a new cycle invalidates every older callback.
 */
export class HighlightRecoveryScheduler {
	private generation = 0;
	private timers = new Set<TimerHandle>();
	private requestedTimer: TimerHandle | undefined;

	constructor(
		private readonly reconcile: () => void,
		private readonly setTimer: SetTimer = (callback, delay) =>
			globalThis.setTimeout(callback, delay),
		private readonly clearTimer: ClearTimer = (handle) =>
			globalThis.clearTimeout(handle),
	) {}

	start(delays: readonly number[] = DEFAULT_RECOVERY_DELAYS) {
		this.stop();
		const generation = this.generation;
		this.reconcile();
		for (const delay of delays) {
			let handle: TimerHandle;
			handle = this.schedule(() => {
				this.timers.delete(handle);
				if (generation === this.generation) this.reconcile();
			}, delay);
			this.timers.add(handle);
		}
	}

	request(delay: number) {
		if (this.requestedTimer !== undefined) {
			this.cancel(this.requestedTimer);
			this.timers.delete(this.requestedTimer);
		}
		const generation = this.generation;
		let handle: TimerHandle;
		handle = this.schedule(() => {
			this.timers.delete(handle);
			if (this.requestedTimer === handle) this.requestedTimer = undefined;
			if (generation === this.generation) this.reconcile();
		}, delay);
		this.requestedTimer = handle;
		this.timers.add(handle);
	}

	runNow() {
		this.reconcile();
	}

	stop() {
		this.generation++;
		for (const timer of this.timers) this.cancel(timer);
		this.timers.clear();
		this.requestedTimer = undefined;
	}

	private schedule(callback: () => void, delay: number) {
		const schedule = this.setTimer;
		return schedule(callback, delay);
	}

	private cancel(handle: TimerHandle) {
		const cancel = this.clearTimer;
		cancel(handle);
	}
}
