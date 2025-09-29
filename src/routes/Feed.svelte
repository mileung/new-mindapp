<script lang="ts">
	import { goto, pushState } from '$app/navigation';
	import { textInputFocused } from '$lib/dom';
	import { gs } from '$lib/globalState.svelte';
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
		loadThoughts,
		rootsPerLoad,
		splitId,
		type ThoughtNested,
	} from '$lib/thoughts';
	import {
		IconChevronRight,
		IconCornerUpLeft,
		IconPencil,
		IconPencilPlus,
		IconX,
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import Highlight from './Highlight.svelte';
	import ThoughtDrop from './ThoughtDrop.svelte';
	import ThoughtWriter from './ThoughtWriter.svelte';
	import { trpc } from '$lib/trpc/client';

	let byMssRegex = /(^|\s)\/_\d*_\/($|\s)/g;
	let quoteRegex = /"([^"]+)"/g;
	let lastRootLatestIdsWithSameMs: string[] = [];
	let p: { hidden?: boolean; modal?: boolean; searchedText: string; idParam?: string } = $props();

	let viewPostToastId = $state('');

	let makeFeedId = (id = '', q = '') => `/${id}?q=${q}`;
	let identifier = $derived(makeFeedId(p.idParam, p.searchedText));
	let nested = $derived(true); // TODO: linear
	let oldestFirst = $derived(false);
	let spotId = $derived(p.idParam && p.idParam[0] !== '_' ? p.idParam : '');
	let personalSpaceRequiresLogin = $derived(
		splitId(p.idParam || '').in_ms === '0' && (!gs.accounts[0] || !gs.accounts[0].ms),
	);
	let allowNewWriting = $derived(!p.modal && !personalSpaceRequiresLogin);

	onMount(() => {
		window.addEventListener('keydown', (e) => {
			if (!p.hidden && !textInputFocused()) {
				if (e.key === 'n' && !gs.writerMode && allowNewWriting) {
					e.preventDefault();
					gs.writerMode = 'new';
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

	let loadMoreThoughts = async (e: InfiniteEvent) => {
		// await new Promise((res) => setTimeout(res, 1000));
		// console.log(
		// 	'loadMoreThoughts',
		// 	identifier,
		// 	$state.snapshot(gs.feeds[identifier]),
		// 	$state.snapshot(gs.thoughts),
		// );
		let fromMs = gs.feeds[identifier]?.slice(-1)[0];
		if (p.idParam === '__1') {
			trpc().getFeed.mutate({});
			return;
		}
		if (fromMs === null) return e.detail.complete();
		if (!p.idParam || personalSpaceRequiresLogin) return;
		fromMs = typeof fromMs === 'number' ? fromMs : oldestFirst ? 0 : Number.MAX_SAFE_INTEGER;

		// TODO: load locally saved roots and only fetch new ones if the user scrolls or interacts with the feed. This is to reduce unnecessary requests when the user just wants to add a thought via the extension
		let thoughts: Awaited<ReturnType<typeof loadThoughts>>;

		if (spotId) {
			thoughts = await loadThoughts({ nested, fromMs, idsInclude: [spotId] });
		} else {
			// TODO: Instead of set theory, implement tag groups
			let ids = getIds(p.searchedText);
			let tagsInclude = getTags(p.searchedText);
			let byMssInclude = p.searchedText.match(byMssRegex)?.map((a) => +a.slice(1));
			let searchedTextNoTagsOrAuthors = p.searchedText
				.replace(bracketRegex, ' ')
				.replace(byMssRegex, ' ');
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

			let bumpedIdsOlderThanFromMs = oldestFirst
				? []
				: (
						(gs.feeds[identifier] || []).filter((i) => {
							if (typeof i !== 'string') return false;
							let segs = splitId(i);
							return +segs.ms < fromMs;
						}) as string[]
					).flatMap((i) => {
						let ids: string[] = [];
						let traverse = (i: string) => {
							let segs = splitId(i);
							+segs.ms < fromMs && ids.push(i);
							gs.thoughts[i]?.childIds?.forEach((i) => traverse(i));
						};
						traverse(i);
						return ids;
					});

			thoughts = await loadThoughts({
				nested,
				fromMs,
				tagsInclude,
				byMssInclude,
				bodyIncludes,
				idsExclude: [
					// TODO: if oldestFirst, exclude the newest root ids with the same ms
					...lastRootLatestIdsWithSameMs,
					...bumpedIdsOlderThanFromMs,
				],
			});
		}
		let { roots, auxThoughts } = thoughts;
		// console.log('thoughts:', thoughts);
		let newThoughts: typeof gs.thoughts = {};
		let lastRoot = roots.slice(-1)[0] as undefined | ThoughtNested;
		let newFromMs = lastRoot?.ms;
		let endReached = roots.length < rootsPerLoad;
		let lastRootNestedIds: Record<number, string[]> = {};

		let traverse = (t: ThoughtNested, rootId: string, helpGetNewFromMs = false) => {
			let id = getId(t);
			if (helpGetNewFromMs) {
				lastRootNestedIds[t.ms!] = (lastRootNestedIds[t.ms!] || []).concat(id);
			}
			for (let child of t.children || []) {
				traverse(child, rootId, helpGetNewFromMs);
			}
			t.childIds =
				t.children?.map((t) => {
					let id = getId(t);
					newThoughts[id] = t;
					return id;
				}) || [];
			delete t.children;
		};
		roots.forEach((t, i) => {
			let rootId = getId(t);
			traverse(t, rootId, !endReached && !oldestFirst && i === roots.length - 1);
			newThoughts[rootId] = t;
		});
		if (!oldestFirst) {
			newFromMs = +Object.keys(lastRootNestedIds).sort((a, b) => +a - +b)[0];
			lastRootLatestIdsWithSameMs = lastRootNestedIds[newFromMs] || [];
		}
		// console.log('gs.thoughts:', $state.snapshot(gs.thoughts));
		// console.log('auxThoughts:', auxThoughts);
		gs.thoughts = {
			...auxThoughts,
			// TODO: deep merge gs.thoughts with auxThoughts
			// Sometimes auxThoughts will overwrite a thought is gs.thoughts, but auxThoughts don't have children - which is why auxThoughts goes above gs.thoughts - so to not delete the childIds in gs.thoughts
			...gs.thoughts,
			...newThoughts,
		};
		let newRootIds = roots.map(getId);
		gs.feeds[identifier] = [
			...((gs.feeds[identifier]?.slice(0, gs.feeds[identifier].length - 1) || []) as string[]),
			...newRootIds,
			endReached ? null : newFromMs!,
		];
		endReached ? e.detail.complete() : e.detail.loaded();
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
			thought.tags = await editThought(thought);
		} else {
			thought = {
				// in_ms: // TODO: gs.spaces[currentSpace].id
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
			gs.feeds = { ...gs.feeds, [identifier]: [tid, ...gs.feeds[identifier]!] };
		}
		gs.writerMode = '';
		viewPostToastId = tid;
		setTimeout(() => (viewPostToastId = ''), 3000);
	};

	let feed = $derived(
		gs.feeds[identifier]?.map((tid) => gs.thoughts[tid || '']).filter((t) => !!t),
	);

	let scrolledToSpotId = $state(false);
	$effect(() => {
		if (p.idParam && !scrolledToSpotId && feed?.length) {
			setTimeout(() => scrollToHighlight(), 0);
		}
	});
</script>

<div class="relative pt-9 xs:pt-0 bg-bg1 flex flex-col min-h-screen">
	{#if personalSpaceRequiresLogin}
		<div class="xy fy gap-2 flex-1">
			<p class="text-2xl sm:text-3xl font-black">{m.signInToUseThisSpace()}</p>
			<a
				href="/sign-in"
				class="fx h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 border-b-4 border-hl1"
			>
				{m.addAccount()}
				<IconChevronRight class="h-5" stroke={3} />
			</a>
		</div>
	{:else if p.idParam === '__' && !p.searchedText && feed && !feed.length}
		welcome
	{:else}
		<div class="space-y-1 my-1">
			{#each feed || [] as thought (getId(thought))}
				<ThoughtDrop {...p} {nested} {thought} depth={0} />
			{/each}
		</div>
		<InfiniteLoading {identifier} spinner="spiral" on:infinite={loadMoreThoughts}>
			<p slot="noResults" class="m-2 text-xl text-fg2">
				<!-- TODO: noResults shows after deleting the one and only thought then making another new thought in Local  -->
				{feed?.length ? m.endOfFeed() : m.noThoughtsFound()}
			</p>
			<p slot="noMore" class="m-2 text-xl text-fg2">{m.endOfFeed()}</p>
			<p slot="error" class="m-2 text-xl text-fg2">{m.anErrorOccurred()}</p>
		</InfiniteLoading>
	{/if}
	{#if p.modal}
		<button
			class="z-50 fixed xy right-1 bottom-1 h-9 w-9 bg-bg5 border-b-4 border-hl1 hover:bg-bg7 hover:border-hl2"
			onclick={() => goto(`/__${gs.accounts[0].currentSpaceMs}`)}
		>
			<IconX class="w-8" />
		</button>
	{:else if allowNewWriting}
		<button
			class="z-50 fixed xy right-1 text-black bottom-1 h-9 w-9 bg-hl1 hover:bg-hl2"
			onclick={() => (gs.writerMode = 'new')}
		>
			<IconPencilPlus class="h-9" />
		</button>
	{/if}

	{#if gs.writerMode}
		<div class="flex-1"></div>
		<div class="sticky bottom-0 z-50">
			<div class="flex group bg-bg4 relative w-full">
				<!-- TODO: save writer data so it persists after page refresh. If the thought it's editing or linking to is not on the feed, open it in a modal? -->
				<button class="truncate flex-1 h-8 pl-2 text-left fx gap-1" onclick={scrollToHighlight}>
					{#if gs.writerMode[0] === 'to'}
						<IconCornerUpLeft class="w-5" />
					{:else if gs.writerMode === 'new'}
						<IconPencilPlus class="w-5" />
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
			<ThoughtWriter onSubmit={submitThought} />
		</div>
	{/if}
	{#if viewPostToastId}
		<a
			href={'/' + viewPostToastId}
			class="fx z-50 fixed h-10 pl-2 font-semibold bottom-2 self-center bg-bg5 hover:bg-bg7 border-b-4 border-hl1"
			onclick={(e) => {
				if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
					e.preventDefault();
					pushState('/' + viewPostToastId, { modalId: viewPostToastId });
				}
			}}
		>
			{m.viewPost()}
			<IconChevronRight class="h-5" stroke={3} />
		</a>
	{/if}
</div>
