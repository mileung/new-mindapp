<script lang="ts">
	import { promptSum } from '$lib/dom';
	import { exportTextAsFile } from '$lib/files';
	import { gs } from '$lib/global-state.svelte';
	import { ranInt } from '$lib/js';
	import { gsdb, initLocalDb, localDbFilename } from '$lib/local-db';
	import { m } from '$lib/paraglide/messages';
	import { setTheme } from '$lib/theme';
	import { day } from '$lib/time';
	import { type PartInsert } from '$lib/types/parts';
	import { pc } from '$lib/types/parts/partCodes';
	import { pf } from '$lib/types/parts/partFilters';
	import { getIdObjAsAtIdObj, getIdStr, id0 } from '$lib/types/parts/partIds';
	import { pTable } from '$lib/types/parts/partsTable';
	import { PostSchema, type Post } from '$lib/types/posts';
	import { addPost } from '$lib/types/posts/addPost';
	import { IconArrowMerge, IconDownload, IconTrash } from '@tabler/icons-svelte';
	import { and, asc } from 'drizzle-orm';
	import { SQLocal } from 'sqlocal';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	let language = $state('en');

	// TODO: allow user to put in domain patterns that render as iframes
	// like if you want to render other mindapp instances hosted elsewhere,
	// you'd list that domain and their urls render iframes in the feed
</script>

<div class="p-2 max-w-lg">
	{#if gs.localDbFailed || gs.invalidLocalCache}
		<p class="text-red-500 border-red-500 border-2 p-2">
			{gs.localDbFailed
				? m.somethingIsWrongWithYourLocalDatabase___()
				: m.somethingIsWrongWithYourLocalCache___()}
		</p>
	{/if}
	<p class="text-xl font-bold">{m.theme()}</p>
	<!-- TODO: make this not flash "system" when refreshing page with light/dark selected -->
	<select
		name={m.theme()}
		class="font-normal text-lg w-full p-2 bg-bg5 hover:bg-bg7 hover:text-fg3 text-fg1"
		value={gs.theme}
		onchange={(e) => {
			// @ts-ignore
			setTheme(e.target.value!);
		}}
	>
		<option value="system">{m.system()}</option>
		<option value="light">{m.light()}</option>
		<option value="dark">{m.dark()}</option>
		<!-- TODO: More themes like a text editor -->
	</select>
	<div class="h-0.5 mt-2 w-full bg-bg8"></div>
	<p class="text-xl font-bold">{m.language()}</p>
	<!-- TODO: make this not flash "system" when refreshing page with light/dark selected -->
	<select
		name={m.language()}
		class="font-normal text-lg w-full p-2 bg-bg5 hover:bg-bg7 hover:text-fg3 text-fg1"
		bind:value={language}
	>
		<option value="en">English</option>
	</select>
	<!-- TODO: Spinners while downloading/importing/deleting local data -->
	<div class="h-0.5 mt-2 w-full bg-bg8"></div>
	<p class="text-xl font-bold">{m.manageLocalDatabase()}</p>

	{#if gs.localDbFailed}
		<button
			class="xy px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500"
			onclick={async () => {
				let { getDatabaseFile } = new SQLocal(localDbFilename);
				let databaseFile = await getDatabaseFile();
				let fileUrl = URL.createObjectURL(databaseFile);
				let a = document.createElement('a');
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
									num: r.num,
									txt: r.txt === null ? undefined : r.txt,
								}) satisfies PartInsert,
						),
					}),
				);
			}}><IconDownload class="w-5 mr-1" />{m.downloadJsonFile()}</button
		>
		<button
			class="xy px-2 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-500"
			onclick={async () => {
				let input = document.createElement('input');
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
														pf.id(post), //
														pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
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
	<div class="h-0.5 mt-2 w-full bg-bg8"></div>
	<p class="text-xl font-bold">{m.dangerZone()}</p>
	<!-- TODO: reset local cache button -->
	<button
		class="xy px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-500"
		onclick={async () => {
			if (
				promptSum((a, b) => m.enterTheSumOfAAndBToIrreversiblyDeleteYourLocalDatabase({ a, b }))
			) {
				try {
					await new SQLocalDrizzle(localDbFilename).sql`DROP TABLE "parts";`;
				} catch (e) {
					alert('Error deleting db' + String(e));
					console.error('error deleteDatabaseFile:', e);
					// deleteDatabaseFile is slow and unreliable
					await new SQLocalDrizzle(localDbFilename).deleteDatabaseFile();
				}
				alert(m.localDatabaseDeleted());
				await initLocalDb();

				// TODO: not great to assume the new local db works after deleting the old one - same for localCache
				gs.localDbFailed = gs.invalidLocalCache = false;
			}
		}}><IconTrash class="w-5 mr-1" />{m.deleteLocalDatabase()}</button
	>
	<!-- {#if dev} -->
	{#if true}
		<div class="h-0.5 mt-2 w-full bg-bg8"></div>
		<p class="text-xl font-bold">Dev Tools</p>
		<button
			class="xy px-2 py-1 bg-yellow-400/20 hover:bg-yellow-500/30 text-yellow-500"
			onclick={async () => {
				try {
					await new SQLocalDrizzle(localDbFilename).sql`DROP TABLE "parts";`;
				} catch (e) {
					console.error('error deleteDatabaseFile:', e);
				}
				await initLocalDb();
				let testTags: string[] = [];
				for (let i = 0; i < 188; i++) testTags.push(`tag${i + 1}`);
				let beginning = new Date('1988-08-08').getTime();
				let posts: Post[] = [];
				for (let i = 0; i < 88; i++) {
					let ranPost = posts[ranInt(0, i * 8)];
					let cid = ranPost ? getIdStr(ranPost) : '';
					let ms = beginning + i * 8 * day;
					let tagCount = ranInt(0, 8);
					let tags = [];
					for (let t = 0; t < tagCount; t++) {
						let tagIndex = ranInt(0, testTags.length - 1);
						tags.push(testTags[tagIndex]);
					}
					posts.push({
						...getIdObjAsAtIdObj(posts[ranInt(0, i * 2)] || id0),
						ms,
						by_ms: 0,
						in_ms: 0,
						history: {
							'1': {
								ms,
								core: `Test post ${i + 1}: Lorem ipsum dolor sit amet ${i} ${cid}`,
								tags,
							},
						},
					});
				}
				console.time('adding posts');
				for (let post of posts) {
					try {
						await addPost(post, true);
					} catch (error) {
						alert(String(error));
					}
					console.log('added post');
				}
				console.timeEnd('adding posts');
			}}><IconTrash class="w-5 mr-1" />Replace feed with test data</button
		>
	{/if}
</div>
