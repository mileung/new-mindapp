<script lang="ts">
	import { dev } from '$app/environment';
	import { exportTextAsFile } from '$lib/files';
	import { gs } from '$lib/global-state.svelte';
	import { gsdb, initLocalDb } from '$lib/local-db';
	import { m } from '$lib/paraglide/messages';
	import { getLocalCache } from '$lib/types/local-cache';
	import {
		filterThought,
		getId,
		_getThoughtById,
		ThoughtInsertSchema,
		type ThoughtInsert,
	} from '$lib/types/thoughts';
	import { thoughtsTable } from '$lib/types/thoughts-table';
	import { IconArrowMerge, IconDownload, IconTrash } from '@tabler/icons-svelte';
	import { asc } from 'drizzle-orm';
	import { SQLocal } from 'sqlocal';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	let dbFilename = 'mindapp.db';
	let setAccountsAndSpaces = async () => {
		let localCache = await getLocalCache();
		gs.accounts = localCache.accounts;
		gs.spaces = localCache.spaces;
	};
</script>

<div class="p-2 space-y-2 w-full max-w-lg">
	{#if gs.localDbFailed || gs.invalidLocalCache}
		<p class="text-red-500 border-red-500 border-2 p-2">
			{gs.localDbFailed
				? m.somethingIsWrongWithYourLocalDatabase___()
				: m.somethingIsWrongWithYourLocalCache___()}
		</p>
	{/if}

	<p class="text-xl font-bold">{m.account()}</p>
	<div class="h-0.5 w-full bg-bg8"></div>
	{#if gs.accounts}
		{#if !gs.accounts[0].ms}
			<p>{m.anon()}</p>
		{:else}
			<p>{m.id()}: <span class="font-medium">_{gs.accounts[0].ms}_</span></p>
			<p>{m.email()}: <span class="font-medium">{gs.accounts[0].email}</span></p>
		{/if}
	{/if}

	<p class="text-xl font-bold">{m.theme()}</p>
	<div class="h-0.5 w-full bg-bg8"></div>
	<!-- TODO: make this not flash "system" when refreshing page with light/dark selected -->
	<select name={m.theme()} class="w-full p-2 bg-bg5 hover:bg-bg7 text-fg1" bind:value={gs.theme}>
		<option value="system">{m.system()}</option>
		<option value="light">{m.light()}</option>
		<option value="dark">{m.dark()}</option>
		<!-- TODO: More themes like a text editor -->
	</select>
	<!-- TODO: Spinners while downloading/importing/deleting local data -->
	<p class="text-xl font-bold">{m.manageLocalDatabase()}</p>
	<div class="h-0.5 w-full bg-bg8"></div>

	{#if gs.localDbFailed}
		<button
			class="xy px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500"
			onclick={async () => {
				const { getDatabaseFile } = new SQLocal(dbFilename);
				const databaseFile = await getDatabaseFile();
				const fileUrl = URL.createObjectURL(databaseFile);
				const a = document.createElement('a');
				a.href = fileUrl;
				a.download = `mindapp-${Date.now()}.db`;
				a.click();
				a.remove();
				URL.revokeObjectURL(fileUrl);
			}}><IconDownload class="w-5 mr-1" />{m.downloadDbFile()}</button
		>
	{:else}
		<button
			class="xy px-2 py-1 bg-sky-400/20 hover:bg-sky-400/30 text-sky-500"
			onclick={async () => {
				exportTextAsFile(
					`mindapp-${Date.now()}.json`,
					JSON.stringify(
						(
							await (
								await gsdb()
							)
								.select()
								.from(thoughtsTable) // TODO: explicitly make rows with null ms cols come first or last?
								// TODO: Also had this idea to export rows based on in_ms or ms range
								.orderBy(asc(thoughtsTable.ms))
						).map(
							(r) =>
								({
									ms: r.ms === null ? undefined : r.ms,
									tags: r.tags === null ? undefined : r.tags,
									body: r.body === null ? undefined : r.body,
									by_ms: r.by_ms === null ? undefined : r.by_ms,
									to_id: r.to_id === null ? undefined : r.to_id,
									in_ms: r.in_ms === null ? undefined : r.in_ms,
								}) satisfies ThoughtInsert,
						),
					),
				);
			}}><IconDownload class="w-5 mr-1" />{m.downloadJsonFile()}</button
		>
		<button
			class="xy px-2 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-500"
			onclick={async () => {
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = 'application/json';
				input.onchange = async (event) => {
					let file = (event.target as HTMLInputElement).files?.[0];
					if (file) {
						console.time('import_time');
						let text = await file.text();
						try {
							let importedThoughts: ThoughtInsert[] = JSON.parse(text);
							if (
								Array.isArray(importedThoughts) &&
								importedThoughts.every((item) => ThoughtInsertSchema.safeParse(item).success)
							) {
								let db = await gsdb();
								// TODO: make importing local data faster
								let results = await Promise.all(
									importedThoughts.map(
										async (thought) =>
											[thought, !!(await _getThoughtById(db, getId(thought)))] as const,
									),
								);
								let inserts: ThoughtInsert[] = [];
								let updates: ThoughtInsert[] = [];
								results.forEach(([thought, exists]) => (exists ? updates : inserts).push(thought));
								await Promise.all([
									...inserts.map((i) => db.insert(thoughtsTable).values(i)),
									...updates.map((u) => db.update(thoughtsTable).set(u).where(filterThought(u))),
								]);
								console.timeEnd('import_time');
								setAccountsAndSpaces();
								gs.feeds = {};
								alert(m.dataSuccessfullyMerged());
							} else {
								alert(m.invalidJsonFile());
							}
						} catch (error) {
							alert(m.invalidJsonFile());
						}
					}
				};
				input.click();
			}}
			><IconArrowMerge class="w-5 mr-1" />
			{m.importJsonFile()}
		</button>
	{/if}
	<p class="text-xl font-bold">{m.dangerZone()}</p>
	<div class="h-0.5 w-full bg-bg8"></div>
	<button
		class="xy px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-500"
		onclick={async () => {
			let requireSumPrompt = !dev;
			// requireSumPrompt = true;
			if (requireSumPrompt) {
				let a = Math.floor(Math.random() * 90) + 10;
				let b = Math.floor(Math.random() * 90) + 10;
				let sum = prompt(m.enterTheSumOfAAndBToIrreversiblyDeleteYourLocalDatabase({ a, b }));
				if (!sum) return;
				if (a + b !== +sum) return alert(m.incorrect());
			}
			const { deleteDatabaseFile } = new SQLocalDrizzle(dbFilename);
			gs.feeds = {};
			await deleteDatabaseFile();
			alert(m.localDatabaseDeleted());
			await initLocalDb();
			setAccountsAndSpaces();
			// TODO: not great to assume the new local db works after deleting the old one - same for localCache
			gs.localDbFailed = gs.invalidLocalCache = false;
		}}><IconTrash class="w-5 mr-1" />{m.deleteLocalDatabase()}</button
	>
</div>
