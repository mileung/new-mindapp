<script lang="ts">
	import { exportTextAsFile } from '$lib/files';
	import { gs } from '$lib/globalState.svelte';
	import { getLocalCache } from '$lib/localCache';
	import { m } from '$lib/paraglide/messages';
	import {
		getIdFilter,
		getThought,
		gsdb,
		initLocalDb,
		ThoughtInsertSchema,
		thoughtsTable,
		type ThoughtInsert,
		type ThoughtSelect,
	} from '$lib/thoughts';
	import { IconArrowMerge, IconDownload, IconTrash } from '@tabler/icons-svelte';
	import { asc, isNotNull } from 'drizzle-orm';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
</script>

<div class="p-2 space-y-2 w-full max-w-xl">
	<p class="text-xl font-bold">{m.theme()}</p>
	<div class="h-0.5 w-full bg-bg8"></div>
	<!-- TODO: make this not flash "system" when refreshing page with light/dark selected -->
	<select
		name={m.theme()}
		class="w-full p-2 rounded bg-bg5 hover:bg-bg7 text-fg1"
		bind:value={gs.theme}
	>
		<option value="system">{m.system()}</option>
		<option value="light">{m.light()}</option>
		<option value="dark">{m.dark()}</option>
		<!-- TODO: More themes like a text editor -->
	</select>
	<!-- TODO: Spinners while downloading/importing/deleting local data -->
	<p class="text-xl font-bold">{m.manageData()}</p>
	<div class="h-0.5 w-full bg-bg8"></div>
	<button
		class="xy px-2 py-1 rounded bg-bg5 hover:bg-bg7 text-fg1"
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
							// TODO: Also had this idea to export rows based on in_id or ms range
							.orderBy(asc(thoughtsTable.ms))
					).map(
						(r) =>
							({
								by_id: r.by_id || undefined,
								to_id: r.to_id || undefined,
								tags: r.tags || undefined,
								body: r.body || undefined,
								ms: r.ms || undefined,
							}) as ThoughtSelect,
					),
				),
			);
		}}><IconDownload class="w-5 mr-1" />{m.downloadLocalData()}</button
	>
	<button
		class="xy px-2 py-1 rounded bg-teal-500/20 hover:bg-teal-500/30 text-teal-500"
		onclick={async () => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'application/json';
			input.onchange = async (event) => {
				let file = (event.target as HTMLInputElement).files?.[0];
				if (file) {
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
									async (thought) => [thought, !!(await getThought(thought))] as const,
								),
							);
							let inserts: ThoughtInsert[] = [];
							let updates: ThoughtInsert[] = [];

							// TODO: insert where it dne, if it does update it
							results.forEach(([thought, exists]) => (exists ? updates : inserts).push(thought));
							await Promise.all([
								...inserts.map((i) => db.insert(thoughtsTable).values(i)),
								...updates.map((u) => db.update(thoughtsTable).set(u).where(getIdFilter(u))),
							]);
							alert(m.dataSuccessfullyMerged());
							gs.feeds['/__'] = undefined;
						} else {
							alert(m.invalidJsonFile());
						}
					} catch (error) {
						alert(m.invalidJsonFile());
					}
				}
			};
			input.click();
		}}><IconArrowMerge class="w-5 mr-1" />{m.importLocalData()}</button
	>
	<div class="h-0.5 w-full bg-bg8"></div>
	<p class="text-xl font-bold">{m.dangerZone()}</p>
	<div class="h-0.5 w-full bg-bg8"></div>
	<button
		class="xy px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-500"
		onclick={async () => {
			let a = Math.floor(Math.random() * 90) + 10;
			let b = Math.floor(Math.random() * 90) + 10;
			let sum = prompt(m.enterTheSumOfAAndBToIrreversiblyDeleteAllLocalData({ a, b }));
			if (!sum) return;
			if (a + b !== +sum) return alert(m.incorrect());
			const { deleteDatabaseFile } = new SQLocalDrizzle('mindapp.db');
			gs.feeds = {};
			await deleteDatabaseFile();
			alert(m.localDataDeleted());
			await initLocalDb();
			let localCache = await getLocalCache();
			gs.accounts = localCache.accounts;
			gs.spaces = localCache.spaces;
		}}><IconTrash class="w-5 mr-1" />{m.deleteLocalData()}</button
	>
</div>
