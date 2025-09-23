<script lang="ts">
	import { goto, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { textInputFocused } from '$lib/dom';
	import { gs, type FeedRootIds } from '$lib/globalState.svelte';
	import { sortUniArr } from '$lib/js';
	import { updateLocalCache } from '$lib/localCache';
	import { m } from '$lib/paraglide/messages';
	import { bracketRegex, getTags } from '$lib/tags';
	import {
		addThought,
		editThought,
		getId,
		getIds,
		idsRegex,
		isId,
		loadThoughts,
		splitId,
		rootsPerLoad,
		type ThoughtInsert,
		type ThoughtNested,
	} from '$lib/thoughts';
	import { IconChevronRight, IconCornerUpLeft, IconPencil, IconX } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import ThoughtDrop from './ThoughtDrop.svelte';
	import Highlight from './Highlight.svelte';
	import ThoughtWriter from './ThoughtWriter.svelte';
	import PencilPlus from '@tabler/icons-svelte/icons/pencil-plus';

	let byIdsRegex = /(^|\s)\/\d*($|\s)/g;
	let quoteRegex = /"([^"]+)"/g;
	let container: HTMLDivElement;
	let p: { hidden?: boolean; modal?: boolean; searchedText: string; idParam?: string } = $props();
	let identifier = $derived(`/${p.idParam}?q=${p.searchedText}`);
	// let nested = $derived(!!p.searchedText || !!p.idParam);
	let nested = $derived(true);
	let spotId = $derived(p.idParam && p.idParam[0] !== '_' ? p.idParam : '');
	let viewPostToastId = $state('');

	let exitSpotId = () => {
		goto(`/__${gs.accounts[0].currentSpaceId}`);
	};

	onMount(() => {
		window.addEventListener('keydown', (e) => {
			if (!p.hidden && !textInputFocused()) {
				if (e.key === 'Escape') {
					spotId ? exitSpotId() : (gs.writerMode = '');
				}
				if (e.key === 'n') {
					e.preventDefault();
					gs.writerMode = gs.writerMode === 'new' ? '' : 'new';
				}
			}
		});
	});

	let scrollToHighlight = () => {
		let id = spotId || gs.writerMode[1];
		let e =
			document.querySelector('#m' + id) || //
			document.querySelector('.m' + id);
		e?.scrollIntoView({ block: 'start' });
	};

	let loadMoreRoots = async (e: InfiniteEvent) => {
		// await new Promise((res) => setTimeout(res, 1000));
		// console.log('loadMoreRoots', identifier);
		if (!p.idParam) return;
		let segs = splitId(p.idParam);
		if (segs.in_id) return;

		// TODO: load locally saved roots and only fetch new ones if the user scrolls or interacts with the feed. This is to reduce unnecessary requests when the user just wants to add a thought via the extension
		let thoughts: Awaited<ReturnType<typeof loadThoughts>>;
		if (gs.feeds[identifier]?.slice(-1)[0] === null) {
			gs.feeds[identifier].length > 1 && e.detail.loaded();
			return e.detail.complete();
		} else if (spotId) {
			thoughts = await loadThoughts({ nested, idsInclude: [spotId] });
		} else {
			// TODO: Instead of set theory, implement tag groups
			let ids = getIds(p.searchedText);
			let tagsInclude = getTags(p.searchedText);
			let byIdsInclude = p.searchedText.match(byIdsRegex)?.map((a) => +a.slice(1));
			let searchedTextNoTagsOrAuthors = p.searchedText
				.replace(bracketRegex, ' ')
				.replace(byIdsRegex, ' ');
			let quotes = (searchedTextNoTagsOrAuthors.match(quoteRegex) || []).map((match) =>
				match.slice(1, -1),
			);
			let bodyIncludes = [
				...quotes,
				...ids,
				...searchedTextNoTagsOrAuthors
					.replace(quoteRegex, ' ')
					.replace(idsRegex, ' ')
					.split(/\s+/g)
					.filter((a) => !!a)
					.map((s) => s.toLowerCase()),
			];

			let fromMs: undefined | number;
			if (nested) {
				//
			} else {
				let lastRootIndex = gs.feeds[identifier]?.findLastIndex((i) => i && !!gs.thoughts[i]) || -1;
				if (lastRootIndex >= 0) {
					let lastRoot = gs.thoughts[gs.feeds[identifier]![lastRootIndex]!]!;
					fromMs = lastRoot.ms!;
					// function traverseNestedIds(t: ThoughtNested) {
					// 	// for latest fromMs
					// 	// callback(node);
					// 	for (const child of t.children || []) {
					// 		traverseNestedIds(child);
					// 	}
					// }
				}
			}

			thoughts = await loadThoughts({
				nested,
				fromMs,
				tagsInclude,
				byIdsInclude,
				bodyIncludes,
				idsExclude: [
					// TODO: Use only the necessary idsExclude
					...(gs.feeds[identifier]?.flatMap((id) => (id ? [id] : [])) || []),
				],
			});
		}
		let { roots, auxThoughts } = thoughts;
		let newThoughts: typeof gs.thoughts = {};
		function traverseNestedThoughts(t: ThoughtNested) {
			for (let child of t.children || []) {
				traverseNestedThoughts(child);
			}
			t.childIds =
				t.children?.map((t) => {
					let id = getId(t);
					newThoughts[id] = t;
					return id;
				}) || [];
			delete t.children;
		}
		roots.forEach((t) => {
			newThoughts[getId(t)] = t;
			traverseNestedThoughts(t);
		});
		gs.thoughts = { ...gs.thoughts, ...auxThoughts, ...newThoughts };
		let newRootIds: FeedRootIds = roots.map(getId);
		roots.length < rootsPerLoad && newRootIds.push(null);
		gs.feeds[identifier] = [...(gs.feeds[identifier] || []), ...newRootIds];
		gs.feeds[identifier][0] === null ? e.detail.complete() : e.detail.loaded();
	};

	let submitThought = async (tags: string[], body: string) => {
		await updateLocalCache((lc) => {
			lc.accounts[0].tags = sortUniArr([
				...gs.accounts[0]!.tags,
				...tags.filter((t) => t[0] !== ' '),
			]);
			return lc;
		});

		let thought: ThoughtNested;
		if (gs.writerMode[0] === 'edit') {
			thought = {
				childIds: [],
				...gs.thoughts[gs.writerMode[1]],
				tags,
				body,
			};
			await editThought(thought);
		} else {
			thought = {
				// in_id: // TODO: gs.spaces[currentSpace].id
				to_id: gs.writerMode[0] === 'to' ? gs.writerMode[1] : null,
				tags: tags.length ? sortUniArr(tags) : null,
				body: body.trim() || null,
				childIds: [],
			};
			thought.ms = await addThought(thought);
		}
		let tid = getId(thought);
		gs.thoughts = { ...gs.thoughts, [tid]: thought };
		if (nested && gs.writerMode[0] === 'to') {
			gs.thoughts[gs.writerMode[1]]?.childIds?.unshift(tid);
		} else if (gs.writerMode[0] !== 'edit') {
			gs.feeds = { ...gs.feeds, [identifier]: [tid, ...(gs.feeds[identifier] || [])] };
		}
		gs.writerMode = '';

		viewPostToastId = tid;
		setTimeout(() => (viewPostToastId = ''), 3000);
	};

	let feed = $derived(
		gs.feeds[identifier]?.map((tid) => tid && gs.thoughts[tid]).filter((t) => !!t) || [],
	);

	let scrolledToSpotId = $state(false);
	$effect(() => {
		if (p.idParam && !scrolledToSpotId && gs.feeds[identifier]?.length) {
			setTimeout(() => scrollToHighlight(), 0);
		}
	});
</script>

{#snippet loader()}<InfiniteLoading
		{identifier}
		spinner="spiral"
		direction={nested ? 'bottom' : 'top'}
		on:infinite={loadMoreRoots}
	>
		<p slot="noResults" class="m-2 text-xl text-fg2">{m.noThoughtsFound()}</p>
		<p slot="noMore" class="m-2 text-xl text-fg2">{m.endOfFeed()}</p>
		<p slot="error" class="m-2 text-xl text-fg2">{m.anErrorOccurred()}</p>
	</InfiniteLoading>
{/snippet}
{#snippet feeder()}
	<div class="space-y-1 my-1">
		{#each nested ? feed : [...feed].reverse() as thought (getId(thought))}
			<ThoughtDrop {...p} {nested} {thought} depth={0} />
		{/each}
	</div>
{/snippet}
{#snippet writer()}
	<ThoughtWriter onSubmit={submitThought} />
{/snippet}
{#snippet rewRootBtn()}
	{#if !p.modal}
		<button
			class="z-50 fixed xy right-1 bottom-1 h-9 w-9 bg-hl1 hover:bg-hl2"
			onclick={() => (gs.writerMode = 'new')}
		>
			<PencilPlus class="h-9" />
		</button>
	{/if}
{/snippet}
<div
	bind:this={container}
	class="relative mt-9 xs:mt-0 bg-bg1 h-[calc(100vh-36px)] xs:h-screen flex flex-col overflow-scroll"
>
	{#if nested}
		<!-- {@render writer()} -->
		{@render rewRootBtn()}
		{@render feeder()}
		{@render loader()}
		<div class="relative flex-1">
			{#if spotId}
				<button
					class="z-50 fixed xy right-1 bottom-1 h-9 w-9 bg-bg5 border-b-4 border-hl1 hover:bg-bg7 hover:border-hl2"
					onclick={exitSpotId}
				>
					<IconX class="w-8" />
				</button>
			{/if}
		</div>
	{:else}
		<div class="flex-1"></div>
		{@render loader()}
		{@render feeder()}
		<!-- {@render writer()} -->
		{@render rewRootBtn()}
	{/if}
	{#if viewPostToastId}
		<a
			href={`/${viewPostToastId}`}
			class="fx z-50 fixed h-10 pl-2 font-semibold bottom-2 self-center bg-bg5 hover:bg-bg7 border-b-4 border-hl1"
			onclick={(e) => {
				if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
					e.preventDefault();
					pushState(`/${viewPostToastId}`, { modalId: viewPostToastId });
				}
			}}
		>
			{m.viewPost()}
			<IconChevronRight class="h-5" stroke={3} />
		</a>
	{/if}
	<div class="sticky bottom-0 z-50">
		{#if gs.writerMode}
			<div class="flex group bg-bg4 relative w-full">
				<button class="truncate flex-1 h-8 pl-2 text-left fx gap-1" onclick={scrollToHighlight}>
					{#if gs.writerMode[0] === 'to'}
						<IconCornerUpLeft class="w-5" />
					{:else}
						<IconPencil class="w-5" />
					{/if}
					<p class="flex-1 truncate">
						{gs.writerMode === 'new' ? m.newPost() : gs.thoughts[gs.writerMode[1]]!.body}
					</p>
				</button>
				<button
					class="w-8 xy text-fg2 hover:bg-bg5 hover:text-fg1"
					onclick={() => (gs.writerMode = '')}
				>
					<IconX class="w-5" />
				</button>
				<Highlight id={gs.writerMode !== 'new' ? gs.writerMode[1] : ''} />
			</div>
			{@render writer()}
		{/if}
	</div>
</div>
