import type { RuntimeRequest, RuntimeResponse } from "../shared/types";

export function sendRuntimeRequest<T>(request: RuntimeRequest): Promise<T> {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(
			request,
			(response: RuntimeResponse<T> | undefined) => {
				const runtimeError = chrome.runtime.lastError;
				if (runtimeError) {
					reject(new Error(runtimeError.message));
					return;
				}
				if (!response) {
					reject(new Error("The extension background service did not respond"));
					return;
				}
				if (!response.ok) {
					reject(new Error(response.error));
					return;
				}
				resolve(response.data);
			},
		);
	});
}
