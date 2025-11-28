<script lang="ts">
	import { dev } from '$app/environment';
	import { exportTextAsFile } from '$lib/files';
	import { getUndefinedLocalFeedIds, gs } from '$lib/global-state.svelte';
	import { identikana, randomInt as ranInt } from '$lib/js';
	import { gsdb, initLocalDb, localDbFilename } from '$lib/local-db';
	import { m } from '$lib/paraglide/messages';
	import { day } from '$lib/time';
	import { getLocalCache } from '$lib/types/local-cache';
	import { type PartInsert } from '$lib/types/parts';
	import { pc } from '$lib/types/parts/partCodes';
	import { pt } from '$lib/types/parts/partFilters';
	import { getIdStr } from '$lib/types/parts/partIds';
	import { pTable } from '$lib/types/parts/partsTable';
	import { PostSchema, type Post } from '$lib/types/posts';
	import { addPost } from '$lib/types/posts/addPost';
	import { IconArrowMerge, IconDownload, IconTrash } from '@tabler/icons-svelte';
	import { and, asc } from 'drizzle-orm';
	import { SQLocal } from 'sqlocal';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import AccountIcon from '../AccountIcon.svelte';
	let setAccountsAndSpaces = () => {
		let localCache = getLocalCache();
		gs.accounts = localCache.accounts;
		gs.idToSpaceMap = localCache.spaces;
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
								.from(pTable) // TODO: explicitly make rows with null ms cols come first or last?
								// TODO: Also had this idea to export rows based on in_ms or ms range
								.orderBy(asc(pTable.ms))
						).map(
							(r) =>
								({
									at_ms: r.at_ms,
									at_by_ms: r.at_by_ms,
									at_in_ms: r.at_in_ms,
									ms: r.ms,
									by_ms: r.by_ms,
									in_ms: r.in_ms,
									code: r.code,
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
							let importedPosts: Post[] = JSON.parse(text);
							if (
								Array.isArray(importedPosts) &&
								importedPosts.every((item) => PostSchema.safeParse(item).success)
							) {
								let oldToNewImportedPosts = importedPosts.sort((a, b) => b.ms - a.ms);
								let db = await gsdb();
								// TODO: make importing local data faster
								let results = await Promise.all(
									oldToNewImportedPosts.map(async (post) => [
										post,
										!!(
											await db
												.select()
												.from(pTable)
												.where(
													and(
														pt.id(post), //
														pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
													),
												)
										)[0],
									]),
								);
								let inserts: PartInsert[] = [];
								let overwrites: PartInsert[] = [];
								// results.forEach(([thought, exists]) =>
								// 	(exists ? overwrites : inserts).push(thought),
								// );
								// await Promise.all([
								// 	...inserts.map((i) => insertLocalPost(i)),
								// 	...overwrites.map((o) => overwriteLocalPost(o)),
								// ]);
								console.timeEnd('import_time');
								setAccountsAndSpaces();
								gs.indentifierToFeedMap = {};
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
			gs.indentifierToFeedMap = { ...gs.indentifierToFeedMap, ...getUndefinedLocalFeedIds() };
			await initLocalDb();
			setAccountsAndSpaces();

			// TODO: not great to assume the new local db works after deleting the old one - same for localCache
			gs.localDbFailed = gs.invalidLocalCache = false;
		}}><IconTrash class="w-5 mr-1" />{m.deleteLocalDatabase()}</button
	>
	{#if dev}
		<p class="text-xl font-bold">Dev Tools</p>
		<div class="h-0.5 w-full bg-bg8"></div>
		<button
			class="xy px-2 py-1 bg-red-500/20 hover:bg-yellow-500/30 text-yellow-500"
			onclick={async () => {
				try {
					await new SQLocalDrizzle(localDbFilename).sql`DROP TABLE "parts";`;
				} catch (e) {
					console.log('error deleteDatabaseFile:', e);
				}
				gs.indentifierToFeedMap = { ...gs.indentifierToFeedMap, ...getUndefinedLocalFeedIds() };
				await initLocalDb();
				setAccountsAndSpaces();
				let beginning = new Date('8-8-88').getTime();
				let posts: Post[] = [];
				for (let i = 0; i < 88; i++) {
					let ranPost = posts[ranInt(0, i * 8)];
					let cid = ranPost ? getIdStr(ranPost) : '';
					let ms = beginning + i * 8 * day;
					posts.push({
						at_ms: 0,
						at_by_ms: 0,
						at_in_ms: 0,
						ms,
						by_ms: 0,
						in_ms: 0,
						history: {
							'0': {
								ms,
								core: `Test post ${i + 1}: Lorem ipsum dolor sit amet ${i} ${cid}`,
								tags: i % 8 === 0 ? [] : ['test', 'dev'],
							},
						},
					});
				}
				for (let post of posts) await addPost(post, false);
			}}><IconTrash class="w-5 mr-1" />Replace feed with test data</button
		>
	{/if}
</div>
