<script lang="ts">
	import { page } from '$app/state';
	import { gs, type FeedRootIds } from '$lib/globalState.svelte';
	import { sortUniArr } from '$lib/js';
	import { getLocalCache, updateLocalCache } from '$lib/localCache';
	import { m } from '$lib/paraglide/messages';
	import { bracketRegex, getTags } from '$lib/tags';
	import {
		filterThoughtId,
		getThoughtId,
		getThoughtIdSegments,
		gsdb,
		isThoughtId,
		loadRoots,
		rootsPerLoad,
		thoughtsTable,
		type ThoughtInsert,
	} from '$lib/thoughts';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import ThoughtDrop from './ThoughtDrop.svelte';
	import ThoughtWriter from './ThoughtWriter.svelte';

	let container: HTMLDivElement;
	let restrainLoad = $state(false);
	let linkingId = $state('');
	let searchedText = $derived(page.url.searchParams.get('q') || '');
	let hierarchical = $derived(!!searchedText);

	let lastSearchedText = $state('');
	$effect(() => {
		if (searchedText !== lastSearchedText) {
			lastSearchedText = searchedText;
			gs.feeds[''] = undefined;
		}
	});

	const loadMoreThoughts = async (e: InfiniteEvent) => {
		// console.log('loadMoreThoughts', searchedText);
		let lastRootId = gs.feeds['']?.slice(-1)[0];
		if (lastRootId === null) {
			e.detail.complete();
		} else {
			let lastRootIndex = gs.feeds['']?.findLastIndex((i) => i && !!gs.thoughts[i]) || -1;
			let fromMs: undefined | number;
			if (lastRootIndex >= 0) {
				let lastRoot = gs.thoughts[gs.feeds['']![lastRootIndex]!]!;
				fromMs = lastRoot.ms!;
			}

			let authorIdsRegex = /\bby:\d*/g;
			let quoteRegex = /"([^"]+)"/g;
			let searchedTags = getTags(searchedText);
			let tagsInclude = searchedTags; // TODO: Instead of set theory, implement tag groups
			let searchedTextNoTagsOrAuthors = searchedText
				.replace(bracketRegex, ' ')
				.replace(authorIdsRegex, ' ');
			let thoughtId = isThoughtId(searchedText) ? searchedText : undefined;
			let authorIdsInclude = searchedText.match(authorIdsRegex)?.map((a) => +a.slice(1));
			let quotes = (searchedTextNoTagsOrAuthors.match(quoteRegex) || []).map((match) =>
				match.slice(1, -1),
			);
			let bodyIncludes = [
				...quotes,
				...searchedTextNoTagsOrAuthors
					.replace(quoteRegex, ' ')
					.split(/\s+/g)
					.filter((a) => !!a)
					.map((s) => s.toLowerCase()),
			].filter((str) => str !== thoughtId);
			// await new Promise((res) => setTimeout(res, 888));
			let { roots } = await loadRoots({
				fromMs,
				tagsInclude,
				authorIdsInclude,
				bodyIncludes,
				excludeIds: [
					// TODO: Use only the necessary excludeIds
					...(gs.feeds['']?.flatMap((id) => (id ? [getThoughtIdSegments({ id })] : [])) || []),
				],
			});
			// console.log('roots:', roots);
			let newRootIds: FeedRootIds = roots.map(getThoughtId);
			roots.length < rootsPerLoad && newRootIds.push(null);
			gs.feeds[''] = [...(gs.feeds[''] || []), ...newRootIds];
			gs.feeds[''][0] === null ? e.detail.complete() : e.detail.loaded();
		}
	};

	let addThought = async (tags: string[], body: string) => {
		let ms = Date.now();
		let newThought: ThoughtInsert = {
			by_id: gs.personas[0]?.id,
			in_id: gs.spaces[0]?.id,
			// to_id, // TODO: linking
			ms,
			tags: tags.length ? sortUniArr(tags) : undefined,
			body: body.trim() || undefined,
		};
		let localCache = await getLocalCache();
		localCache.personas[0].tags = sortUniArr([...gs.personas[0]!.tags, ...tags]);
		await updateLocalCache(localCache);
		gs.personas = localCache.personas;
		await (await gsdb()).insert(thoughtsTable).values(newThought);
		let [thought] = await (await gsdb())
			.select()
			.from(thoughtsTable)
			.where(filterThoughtId(newThought))
			.limit(1);
		let tid = getThoughtId(thought);
		gs.thoughts = { ...gs.thoughts, [tid]: thought };
		gs.feeds = { ...gs.feeds, ['']: [tid, ...(gs.feeds[''] || [])] };
		setTimeout(() => {
			container.scrollTop = container.scrollHeight;
		}, 0);
	};

	$effect(() => {
		console.log(page);
		// console.log('asdf', $state.snapshot(gs.feeds['']));
	});

	let initialTags = $state([]);
	let initialBody = $state('');

	let feed = $derived(gs.feeds['']?.map((tid) => tid && gs.thoughts[tid]).filter((t) => !!t) || []);
</script>

{#snippet loader()}<InfiniteLoading
		identifier={searchedText}
		spinner="spiral"
		direction={hierarchical ? 'bottom' : 'top'}
		on:infinite={loadMoreThoughts}
	>
		<p slot="noResults" class="text-xl text-fg2">{m.noThoughtsFound()}</p>
		<p slot="noMore" class="text-xl text-fg2">{m.endOfFeed()}</p>
		<p slot="error" class="text-xl text-fg2">{m.anErrorOccurred()}</p>
	</InfiniteLoading>
{/snippet}
{#snippet feeder()}
	{#each hierarchical ? feed : [...feed].reverse() as thought}
		<ThoughtDrop
			{thought}
			linking={thought === gs.thoughts[linkingId]}
			onLink={() => (linkingId = getThoughtId(thought))}
		/>
	{/each}
{/snippet}
{#snippet writer()}<ThoughtWriter
		{initialTags}
		{initialBody}
		onSubmit={(tags, body) => addThought(tags, body)}
	/>
{/snippet}
<div bind:this={container} class={`h-screen flex flex-col space-y-2 px-2 overflow-scroll`}>
	{#if hierarchical}
		<div></div>
		<!-- {@render writer()} -->
		{@render feeder()}
		{@render loader()}
		<div></div>
	{:else}
		<div class="flex-1"></div>
		{@render loader()}
		{@render feeder()}
		<div class="bg-bg1 sticky bottom-0 p-2 -m-2">
			{@render writer()}
		</div>
	{/if}
</div>
