import { createBackup, parseBackup } from "./background/backup";
import {
	deleteAllHighlights,
	importHighlights,
	listHighlights,
} from "./background/database";

const count = requiredElement<HTMLElement>("highlight-count");
const status = requiredElement<HTMLElement>("status");
const exportButton = requiredElement<HTMLButtonElement>("export-backup");
const importButton = requiredElement<HTMLButtonElement>("import-backup");
const importInput = requiredElement<HTMLInputElement>("import-file");
const deleteButton = requiredElement<HTMLButtonElement>("delete-all");
const deleteDialog = requiredElement<HTMLDialogElement>("delete-dialog");
const cancelDelete = requiredElement<HTMLButtonElement>("cancel-delete");
const confirmDelete = requiredElement<HTMLButtonElement>("confirm-delete");

void refreshCount();

exportButton.addEventListener("click", async () => {
	setBusy(exportButton, true);
	try {
		const backup = createBackup(await listHighlights());
		downloadJson(
			`highlights-backup-${new Date().toISOString().slice(0, 10)}.json`,
			backup,
		);
		showStatus("Backup exported.", "success");
	} catch (error) {
		showStatus(getErrorMessage(error), "error");
	} finally {
		setBusy(exportButton, false);
	}
});

importButton.addEventListener("click", () => importInput.click());
importInput.addEventListener("change", async () => {
	const file = importInput.files?.[0];
	if (!file) return;
	setBusy(importButton, true);
	try {
		const parsed = JSON.parse(await file.text()) as unknown;
		const records = parseBackup(parsed);
		await importHighlights(records);
		showStatus(
			records.length === 1
				? "Imported 1 highlight."
				: `Imported ${records.length} highlights.`,
			"success",
		);
		await refreshCount();
	} catch (error) {
		showStatus(getErrorMessage(error), "error");
	} finally {
		importInput.value = "";
		setBusy(importButton, false);
	}
});

deleteButton.addEventListener("click", () => deleteDialog.showModal());
cancelDelete.addEventListener("click", () => deleteDialog.close());
confirmDelete.addEventListener("click", async () => {
	setBusy(confirmDelete, true);
	try {
		await deleteAllHighlights();
		deleteDialog.close();
		showStatus("All highlights were deleted.", "success");
		await refreshCount();
	} catch (error) {
		showStatus(getErrorMessage(error), "error");
	} finally {
		setBusy(confirmDelete, false);
	}
});

async function refreshCount() {
	const records = await listHighlights();
	count.textContent = records.length.toLocaleString();
}

function downloadJson(filename: string, value: unknown) {
	const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

function setBusy(button: HTMLButtonElement, busy: boolean) {
	button.disabled = busy;
	button.setAttribute("aria-busy", String(busy));
}

function showStatus(message: string, tone: "success" | "error") {
	status.textContent = message;
	status.dataset.tone = tone;
	status.hidden = false;
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Something went wrong";
}

function requiredElement<T extends HTMLElement>(id: string) {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing #${id}`);
	return element as T;
}
