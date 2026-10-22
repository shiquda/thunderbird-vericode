import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const core = readFileSync(new URL("../lib/verification-core.js", import.meta.url), "utf8");
const background = readFileSync(new URL("../background.js", import.meta.url), "utf8");

async function setup({ action = "none", writeClipboard, trash = true, failMove = false } = {}) {
	const inbox = { id: "a://Inbox", accountId: "a", path: "/Inbox" };
	const trashFolder = { id: "a://Trash", accountId: "a", path: "/Trash", specialUse: ["trash"] };
	const secondInbox = { id: "b://Inbox", accountId: "b", path: "/Inbox" };
	const trashFolders = new Map([
		["a", trashFolder],
		["b", { id: "b://Trash", accountId: "b", path: "/Trash", specialUse: ["trash"] }],
	]);
	const messages = new Map([
		[1, { id: 1, author: "First <first@example.invalid>", folder: inbox }],
		[2, { id: 2, author: "Second <second@example.invalid>", folder: secondInbox }],
	]);
	const state = { clipboard: null, operations: [], accounts: [], notifications: new Map() };
	const listeners = { clicked: [], closed: [] };
	const context = {
		module: { exports: {} },
		console: { log() {}, error() {} },
		setTimeout() { throw new Error("Tests disable notification expiry"); },
		navigator: { clipboard: { async writeText(code) {
			if (writeClipboard) await writeClipboard(code);
			state.clipboard = code;
		} } },
		browser: {
			runtime: { getURL: path => path },
			storage: {
				local: {
					get: async defaults => ({ ...defaults, postCopyAction: action, notificationTimeout: 0 }),
					set: async values => { if ("postCopyAction" in values) action = values.postCopyAction; },
				},
				onChanged: { addListener() {} },
			},
			messengerUtilities: { parseMailboxString: async author => [{ name: author }] },
			accounts: { async get(accountId) {
				state.accounts.push(accountId);
				if (!trashFolders.has(accountId)) throw new Error("Unknown account");
				return { id: accountId, folders: trash ? [{ subFolders: [trashFolders.get(accountId)] }] : [] };
			} },
			messages: {
				onNewMailReceived: { addListener() {} },
				get: async id => messages.get(id),
				async archive(ids) {
					state.operations.push({ kind: "archive", ids: [...ids], clipboard: state.clipboard });
					for (const id of ids) messages.get(id).folder = { ...messages.get(id).folder, path: "/Archives" };
				},
				async move(ids, destination) {
					if (failMove) throw new Error("Folder is read-only");
					const destinationFolder = [...trashFolders.values()].find(folder => folder.id === destination);
					if (!destinationFolder) throw new Error("Unknown destination");
					state.operations.push({ kind: "trash", ids: [...ids], clipboard: state.clipboard });
					for (const id of ids) messages.get(id).folder = destinationFolder;
				},
				async delete() { throw new Error("Permanent/account-configured deletion must never be used"); },
			},
			notifications: {
				create: async (id, options) => { state.notifications.set(id, options); return id; },
				clear: async id => {
					const removed = state.notifications.delete(id);
					for (const fn of listeners.closed) fn(id);
					return removed;
				},
				onClicked: { addListener: fn => listeners.clicked.push(fn) },
				onClosed: { addListener: fn => listeners.closed.push(fn) },
			},
		},
	};
	runInNewContext(core, context);
	await runInNewContext(background, context);
	const evaluate = code => runInNewContext(code, context);
	return {
		state, messages, listeners, evaluate,
		create: (id, code) => evaluate(`createNotificationWithCopyButton(${JSON.stringify(messages.get(id))}, ${JSON.stringify(code)})`),
		click: id => evaluate(`handleNotificationClick(${JSON.stringify(id)})`),
	};
}

test("Clicking one of several notifications copies and archives only its email", async () => {
	const app = await setup({ action: "archive" });
	const first = await app.create(1, "111111");
	const second = await app.create(2, "222222");
	await app.click(first);
	assert.equal(app.state.clipboard, "111111");
	assert.equal(app.messages.get(1).folder.path, "/Archives");
	assert.equal(app.messages.get(2).folder.path, "/Inbox");
	assert.equal(app.state.notifications.has(second), true);
	await app.click(second);
	assert.equal(app.state.clipboard, "222222");
	assert.equal(app.messages.get(2).folder.path, "/Archives");
});

test("Default action copies the code without changing the email", async () => {
	const app = await setup();
	await app.click(await app.create(1, "123456"));
	assert.equal(app.state.clipboard, "123456");
	assert.equal(app.messages.get(1).folder.path, "/Inbox");
	assert.deepEqual(app.state.operations, []);
});

test("Trash action uses the copied email's own account and never delete", async () => {
	const app = await setup({ action: "trash" });
	await app.click(await app.create(2, "654321"));
	assert.equal(app.messages.get(2).folder.path, "/Trash");
	assert.equal(app.messages.get(2).folder.accountId, "b");
	assert.equal(app.messages.get(1).folder.path, "/Inbox");
	assert.deepEqual(app.state.accounts, ["b"]);
	assert.deepEqual(app.state.operations, [{ kind: "trash", ids: [2], clipboard: "654321" }]);
});

test("Clipboard failure prevents both archive and trash actions", async () => {
	for (const action of ["archive", "trash"]) {
		const app = await setup({ action, writeClipboard: async () => { throw new Error("Clipboard denied"); } });
		await app.click(await app.create(1, "123456"));
		assert.equal(app.state.clipboard, null);
		assert.equal(app.messages.get(1).folder.path, "/Inbox");
		assert.deepEqual(app.state.operations, []);
	}
});

test("Missing or read-only Trash does not fall back to deletion", async () => {
	for (const options of [{ trash: false }, { failMove: true }]) {
		const app = await setup({ action: "trash", ...options });
		await app.click(await app.create(1, "123456"));
		assert.equal(app.state.clipboard, "123456");
		assert.equal(app.messages.get(1).folder.path, "/Inbox");
		assert.deepEqual(app.state.operations, []);
	}
});

test("Repeated clicks while copying do not repeat the mail action", async () => {
	let finishCopy;
	const app = await setup({ action: "archive", writeClipboard: () => new Promise(resolve => { finishCopy = resolve; }) });
	const id = await app.create(1, "123456");
	const firstClick = app.click(id);
	await app.click(id);
	assert.equal(app.messages.get(1).folder.path, "/Inbox");
	finishCopy();
	await firstClick;
	await app.click(id);
	assert.deepEqual(app.state.operations, [{ kind: "archive", ids: [1], clipboard: "123456" }]);
});

test("Changing the action while copying cannot enable an unexpected move", async () => {
	let finishCopy;
	let startedCopy;
	const copying = new Promise(resolve => { startedCopy = resolve; });
	const app = await setup({ writeClipboard: () => new Promise(resolve => { finishCopy = resolve; startedCopy(); }) });
	const copy = app.click(await app.create(1, "123456"));
	await copying;
	await app.evaluate('browser.storage.local.set({postCopyAction: "trash"})');
	finishCopy();
	await copy;
	assert.equal(app.state.clipboard, "123456");
	assert.equal(app.messages.get(1).folder.path, "/Inbox");
	assert.deepEqual(app.state.operations, []);
});

test("Automatic copying applies the same archive action", async () => {
	const app = await setup({ action: "archive" });
	await app.evaluate('autoCopyToClipboard({id: 2, author: "Second"}, "654321")');
	assert.equal(app.state.clipboard, "654321");
	assert.equal(app.messages.get(2).folder.path, "/Archives");
	assert.equal(app.messages.get(1).folder.path, "/Inbox");
});

test("Closing a notification makes later clicks harmless", async () => {
	const app = await setup({ action: "trash" });
	const id = await app.create(1, "123456");
	for (const close of app.listeners.closed) close(id);
	await app.click(id);
	assert.equal(app.state.clipboard, null);
	assert.equal(app.messages.get(1).folder.path, "/Inbox");
	assert.deepEqual(app.state.operations, []);
});

test("An older settings read cannot re-enable Trash after the user selects no action", async () => {
	const app = await setup();
	await app.evaluate(`(async () => {
		const reads = [];
		const originalGet = browser.storage.local.get;
		browser.storage.local.get = () => new Promise(resolve => reads.push(resolve));
		const older = loadSettings();
		const newer = loadSettings();
		reads[1]({ ...settings, postCopyAction: "none" });
		await newer;
		reads[0]({ ...settings, postCopyAction: "trash" });
		await older;
		browser.storage.local.get = originalGet;
	})()`);
	await app.click(await app.create(1, "123456"));
	assert.equal(app.state.clipboard, "123456");
	assert.equal(app.messages.get(1).folder.path, "/Inbox");
	assert.deepEqual(app.state.operations, []);
});
