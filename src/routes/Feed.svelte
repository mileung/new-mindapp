<script lang="ts">
	import { goto } from '$app/navigation';
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
		isId,
		loadThoughts,
		rootsPerLoad,
		type ThoughtInsert,
		type ThoughtNested,
	} from '$lib/thoughts';
	import { IconCornerUpLeft, IconPencil, IconX } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import ThoughtDrop from './ThoughtDrop.svelte';
	import ThoughtHighlight from './ThoughtHighlight.svelte';
	import ThoughtWriter from './ThoughtWriter.svelte';

	let authorIdsRegex = /\bby:\d*/g;
	let quoteRegex = /"([^"]+)"/g;
	let container: HTMLDivElement;
	let p: { modal?: boolean; searchedText: string; spotId?: string } = $props();
	// TODO: I think SvelteKit has a bug where page doesn't react when using pushState
	let urlPath = $derived(p.spotId ? `/${p.spotId}` : page.url.pathname + page.url.search);
	let toId = $state('');
	let editId = $state('');
	let lastSearchedText = $state('');
	let highlightedThought = $derived(gs.thoughts[toId || editId]);
	let nested = $derived(!!p.searchedText || !!p.spotId);

	let scrollToHighlight = () => {
		let id = toId || editId || p.spotId;
		let e =
			document.querySelector('#m' + id) || //
			document.querySelector('.m' + id);
		e?.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
		});
	};

	let loadMoreRoots = async (e: InfiniteEvent) => {
		if (urlPath === '/?extension') return;

		// TODO: load locally saved roots and only fetch new ones if the user scrolls or interacts with the feed. This is to reduce unnecessary requests when the user just wants to add a thought via the extension
		let thoughts: Awaited<ReturnType<typeof loadThoughts>>;
		if (gs.feeds[urlPath]?.slice(-1)[0] === null) {
			gs.feeds[urlPath].length > 1 && e.detail.loaded();
			return e.detail.complete();
		} else if (p.spotId) {
			thoughts = await loadThoughts({ nested, idsInclude: [p.spotId] });
		} else {
			let searchedTags = getTags(p.searchedText);
			let tagsInclude = searchedTags; // TODO: Instead of set theory, implement tag groups
			let searchedTextNoTagsOrAuthors = p.searchedText
				.replace(bracketRegex, ' ')
				.replace(authorIdsRegex, ' ');
			let id = isId(p.searchedText) ? p.searchedText : undefined;
			let authorIdsInclude = p.searchedText.match(authorIdsRegex)?.map((a) => +a.slice(1));
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
			].filter((str) => str !== id);
			let lastRootIndex = gs.feeds[urlPath]?.findLastIndex((i) => i && !!gs.thoughts[i]) || -1;
			let fromMs: undefined | number;
			if (lastRootIndex >= 0) {
				let lastRoot = gs.thoughts[gs.feeds[urlPath]![lastRootIndex]!]!;
				fromMs = lastRoot.ms!;
				function traverseNestedIds(t: ThoughtNested) {
					// for latest fromMs
					// callback(node);
					for (const child of t.children || []) {
						traverseNestedIds(child);
					}
				}
			}
			thoughts = await loadThoughts({
				nested,
				fromMs,
				tagsInclude,
				authorIdsInclude,
				bodyIncludes,
				idsExclude: [
					// TODO: Use only the necessary idsExclude
					...(gs.feeds[urlPath]?.flatMap((id) => (id ? [id] : [])) || []),
				],
			});
		}
		await new Promise((res) => setTimeout(res, 1000));
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
		gs.feeds[urlPath] = [...(gs.feeds[urlPath] || []), ...newRootIds];
		gs.feeds[urlPath][0] === null ? e.detail.complete() : e.detail.loaded();
	};

	let submitThought = async (tags: string[], body: string) => {
		await updateLocalCache((lc) => {
			lc.accounts[0].tags = sortUniArr([
				...gs.accounts[0]!.tags,
				...tags.filter((t) => t[0] !== ' '),
			]);
			return lc;
		});

		let thought: ThoughtInsert;
		if (editId) {
			thought = {
				...highlightedThought,
				tags,
				body,
			};
			await editThought(thought);
		} else {
			thought = {
				// in_id: // TODO: gs.spaces[currentSpace].id
				to_id: toId || null,
				tags: tags.length ? sortUniArr(tags) : null,
				body: body.trim() || null,
			};
			thought.ms = await addThought(thought);
		}
		let tid = getId(thought);
		gs.thoughts = { ...gs.thoughts, [tid]: thought };
		if (nested) {
			gs.thoughts[toId]?.childIds?.unshift(tid);
		} else if (!editId) gs.feeds = { ...gs.feeds, [urlPath]: [tid, ...(gs.feeds[urlPath] || [])] };

		toId = '';
		editId = '';

		setTimeout(() => {
			if (!nested) container.scrollTop = container.scrollHeight;
		}, 0);
	};

	$effect(() => {
		// console.log(page);
		// console.log('asdf', $state.snapshot(gs.feeds[urlPath]));
		// TODO: when linking or editing a thought on the bottom of a non nested feed, scroll feed to bottom so the button on the bottom doesn't cover the thought
		// if (toId || editId) container.scrollTop = Number.MAX_SAFE_INTEGER;
	});

	let exitModal = () => {
		goto(page.state.fromPathname!);
		page.state.modalId = page.state.fromPathname = undefined;
	};

	onMount(() => {
		// container.scrollTop = nested ? 0 : Number.MAX_SAFE_INTEGER;
		// setTimeout(() => {
		// 	container.scrollTop = nested ? 0 : Number.MAX_SAFE_INTEGER;
		// }, 0);
		window.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && !textInputFocused()) {
				page.state.modalId ? exitModal() : (toId = editId = '');
			}
		});
	});

	$effect(() => {
		if (p.searchedText !== lastSearchedText) {
			lastSearchedText = p.searchedText;
			gs.feeds[urlPath] = undefined;
		}
	});

	let feed = $derived(
		gs.feeds[urlPath]?.map((tid) => tid && gs.thoughts[tid]).filter((t) => !!t) || [],
	);

	let scrolledToSpotId = $state(false);
	$effect(() => {
		if (p.spotId && !scrolledToSpotId && feed.length) {
			scrollToHighlight();
			scrolledToSpotId = true;
		}
	});

	$effect(() => {
		// console.log('feed:', feed, gs.feeds[urlPath]);
		if ((toId || editId) && !highlightedThought) toId = editId = '';
	});
</script>

{#snippet loader()}<InfiniteLoading
		identifier={urlPath}
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
		{#each nested ? feed : [...feed].reverse() as thought}
			<ThoughtDrop
				{...p}
				{nested}
				depth={0}
				{thought}
				{toId}
				{editId}
				onLink={(id) => ((editId = ''), (toId = id === toId ? '' : id))}
				onEdit={(id) => ((toId = ''), (editId = id === editId ? '' : id))}
			/>
		{/each}
	</div>
{/snippet}
<div
	bind:this={container}
	class={`pt-9 xs:pt-0 bg-bg1 h-screen flex flex-col overflow-scroll ${p.modal ? 'pr-10' : ''}`}
>
	{#if nested}
		{@render feeder()}
		{#if p.modal}
			<button class="fixed top-0 right-0 h-10 w-10 xy" onclick={exitModal}>
				<IconX class="w-8" />
			</button>
		{/if}
		{@render loader()}
		<div class="flex-1"></div>
	{:else}
		<div class="flex-1"></div>
		{@render loader()}
		{@render feeder()}
	{/if}
	<div class="sticky bottom-0 z-50">
		{#if highlightedThought}
			<div class="flex group bg-bg3 relative w-full">
				<button class="truncate flex-1 h-8 pl-2 text-left fx gap-1" onclick={scrollToHighlight}>
					{#if toId}
						<IconCornerUpLeft class="w-5" />
					{:else}
						<IconPencil class="w-5" />
					{/if}
					<p class="flex-1 truncate">{highlightedThought.body}</p>
				</button>
				<button class="w-8 xy text-fg2 hover:text-fg1" onclick={() => (toId = editId = '')}>
					<IconX class="w-5" />
				</button>
				<!-- <div
					class={`z-50 pointer-events-none absolute inset-0 ${toId ? 'group-hover:bg-hl-link/10' : 'group-hover:bg-hl-edit/10'}`}
				>
					<div class={`w-0.5 h-full ${toId ? 'bg-hl-link' : 'bg-hl-edit'}`}></div>
				</div> -->
				<ThoughtHighlight id={getId(highlightedThought)} {toId} {editId} />
			</div>
		{/if}
		<ThoughtWriter {toId} {editId} onSubmit={(tags, body) => submitThought(tags, body)} />
	</div>
</div>
