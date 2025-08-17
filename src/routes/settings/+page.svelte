<script lang="ts">
	import { exportTextAsFile } from '$lib/files';
	import { gs } from '$lib/globalState.svelte';
	import { m } from '$lib/paraglide/messages';
	import {
		filterThoughtId,
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
		class="w-full p-2 rounded transition bg-bg5 hover:bg-bg7 text-fg1"
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
		class="xy px-2 py-1 rounded transition bg-bg5 hover:bg-bg7 text-fg1"
		onclick={async () => {
			exportTextAsFile(
				`mindapp-${Date.now()}.json`,
				JSON.stringify(
					(
						await (await gsdb())
							.select()
							.from(thoughtsTable)
							.where(isNotNull(thoughtsTable.ms))
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
		class="xy px-2 py-1 rounded transition bg-teal-500/20 hover:bg-teal-500/30 text-teal-500"
		onclick={async () => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'application/json';
			input.onchange = async (event) => {
				const file = (event.target as HTMLInputElement).files?.[0];
				if (file) {
					const text = await file.text();
					try {
						const importedThoughts: ThoughtInsert[] = JSON.parse(text);
						if (
							Array.isArray(importedThoughts) &&
							importedThoughts.every((item) => ThoughtInsertSchema.safeParse(item).success)
						) {
							const db = await gsdb();
							let newThoughts: ThoughtInsert[] = [];
							for (const thought of importedThoughts) {
								const [existingThought] = await db
									.select()
									.from(thoughtsTable)
									.where(filterThoughtId(thought))
									.limit(1);
								if (existingThought) {
									if (
										(existingThought.body || undefined) !== (thought.body || undefined) ||
										JSON.stringify(existingThought.tags || undefined) !==
											JSON.stringify(thought.tags || undefined) ||
										(existingThought.in_id || undefined) !== (thought.in_id || undefined)
									) {
										return alert(
											m.thoughtsWithTheSamePrimaryKeyButDifferentTagsBodyToIdFound() +
												'\n\nexistingThought: ' +
												JSON.stringify(
													{
														body: existingThought.body || undefined,
														ms: existingThought.ms || undefined,
														tags: existingThought.tags || undefined,
														by_id: existingThought.by_id || undefined,
														to_id: existingThought.to_id || undefined,
														in_id: existingThought.in_id || undefined,
													},
													null,
													2,
												) +
												'\n\nthought: ' +
												JSON.stringify(
													{
														body: thought.body || undefined,
														ms: thought.ms || undefined,
														tags: thought.tags || undefined,
														by_id: thought.by_id || undefined,
														to_id: thought.to_id || undefined,
														in_id: thought.in_id || undefined,
													},
													null,
													2,
												),
										);
									}
								} else {
									newThoughts.push(thought);
								}
							}
							for (const thought of newThoughts) {
								await db.insert(thoughtsTable).values(thought);
							}
							alert(m.dataSuccessfullyMerged());
							gs.feeds[''] = undefined;
						} else {
							alert(m.invalidJsonFile());
						}
					} catch (error) {
						alert(m.invalidJsonFile());
					}
				}
			};
			input.click();
		}}><IconArrowMerge class="w-5 mr-1" />{m.importAndMergeData()}</button
	>
	<div class="h-0.5 w-full bg-bg8"></div>
	<p class="text-xl font-bold">{m.dangerZone()}</p>
	<div class="h-0.5 w-full bg-bg8"></div>
	<button
		class="xy px-2 py-1 rounded transition bg-red-500/20 hover:bg-red-500/30 text-red-500"
		onclick={async () => {
			let a = Math.floor(Math.random() * 90) + 10;
			let b = Math.floor(Math.random() * 90) + 10;
			let sum = prompt(m.enterTheSumOfAAndBToIrreversiblyDeleteAllLocalData({ a, b }));
			if (!sum) return;
			if (a + b !== +sum) return alert(m.incorrect());
			const { deleteDatabaseFile } = new SQLocalDrizzle('mindapp.db');
			await deleteDatabaseFile();
			alert(m.localDataDeleted());
			gs.feeds[''] = [];
			await initLocalDb();
		}}><IconTrash class="w-5 mr-1" />{m.deleteLocalData()}</button
	>
</div>
