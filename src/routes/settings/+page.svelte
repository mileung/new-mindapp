<script lang="ts">
	import { dev } from '$app/environment';
	import { exportTextAsFile } from '$lib/files';
	import { getUndefinedLocalFeedIds, gs } from '$lib/global-state.svelte';
	import { localDbFilename, gsdb, initLocalDb } from '$lib/local-db';
	import { m } from '$lib/paraglide/messages';
	import { getLocalCache } from '$lib/types/local-cache';
	import {
		getId,
		_selectNode,
		PartInsertSchema,
		type PartInsert,
		overwriteLocalPost,
	} from '$lib/types/parts';
	import { partsTable } from '$lib/types/parts-table';
	import { IconArrowMerge, IconDownload, IconTrash } from '@tabler/icons-svelte';
	import { asc } from 'drizzle-orm';
	import { SQLocal } from 'sqlocal';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import AccountIcon from '../AccountIcon.svelte';
	import { identikana } from '$lib/js';
	let setAccountsAndSpaces = () => {
		let localCache = getLocalCache();
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
			<div class="fx h-10">
				<AccountIcon class="h-10 w-10" ms={gs.accounts[0].ms} />
				<p class="ml-2 font-medium text-lg">{identikana(gs.accounts[0].ms)}</p>
			</div>
			<p>{m.ms()}: <span class="font-medium">{gs.accounts[0].ms}</span></p>
			<p>{m.email()}: <span class="font-medium">{gs.accounts[0].email}</span></p>
		{/if}
	{/if}

	<p class="text-xl font-bold">{m.theme()}</p>
	<div class="h-0.5 w-full bg-bg8"></div>
	<!-- TODO: make this not flash "system" when refreshing page with light/dark selected -->
	<select
		name={m.theme()}
		class="font-normal text-lg w-full p-2 bg-bg5 hover:bg-bg7 text-fg1"
		bind:value={gs.theme}
	>
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
				const { getDatabaseFile } = new SQLocal(localDbFilename);
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
					JSON.stringify({
						parts: (
							await (
								await gsdb()
							)
								.select()
								.from(partsTable) // TODO: explicitly make rows with null ms cols come first or last?
								// TODO: Also had this idea to export rows based on in_ms or ms range
								.orderBy(asc(partsTable.ms))
						).map(
							(r) =>
								({
									to_ms: r.to_ms === null ? undefined : r.to_ms,
									to_by_ms: r.to_by_ms === null ? undefined : r.to_by_ms,
									to_in_ms: r.to_in_ms === null ? undefined : r.to_in_ms,
									ms: r.ms === null ? undefined : r.ms,
									by_ms: r.by_ms === null ? undefined : r.by_ms,
									in_ms: r.in_ms === null ? undefined : r.in_ms,
									code: r.code === null ? undefined : r.code,
									txt: r.txt === null ? undefined : r.txt,
									num: r.num === null ? undefined : r.num,
								}) satisfies PartInsert,
						),
					}),
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
							let importedPosts: PartInsert[] = JSON.parse(text);
							if (
								Array.isArray(importedPosts) &&
								importedPosts.every((item) => PartInsertSchema.safeParse(item).success)
							) {
								let db = await gsdb();
								// TODO: make importing local data faster
								let results = await Promise.all(
									importedPosts.map(
										async (node) => [node, !!(await _selectNode(db, node))] as const,
									),
								);
								let inserts: PartInsert[] = [];
								let overwrites: PartInsert[] = [];
								results.forEach(([thought, exists]) =>
									(exists ? overwrites : inserts).push(thought),
								);
								// await Promise.all([
								// 	...inserts.map((i) => insertLocalPost(i)),
								// 	...overwrites.map((o) => overwriteLocalPost(o)),
								// ]);
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
	<!-- TODO: reset local cache button -->
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

			try {
				// deleteDatabaseFile is slow and unreliable
				// await new SQLocalDrizzle(localDbFilename).deleteDatabaseFile();
				await new SQLocalDrizzle(localDbFilename).sql`DROP TABLE "parts";`;
			} catch (e) {
				console.log('error deleteDatabaseFile:', e);
			}
			!dev && alert(m.localDatabaseDeleted());
			gs.feeds = { ...gs.feeds, ...getUndefinedLocalFeedIds() };
			await initLocalDb();
			setAccountsAndSpaces();

			console.log('yes');

			// TODO: not great to assume the new local db works after deleting the old one - same for localCache
			gs.localDbFailed = gs.invalidLocalCache = false;
		}}><IconTrash class="w-5 mr-1" />{m.deleteLocalDatabase()}</button
	>
</div>
