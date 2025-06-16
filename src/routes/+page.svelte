<script lang="ts">
	import { scrollToBottom } from '$lib/dom';
	import { gs } from '$lib/globalState.svelte';
	import { and, desc, eq, isNull } from 'drizzle-orm';
	import { onMount } from 'svelte';
	import ThoughtWriter from './ThoughtWriter.svelte';
	import {
		getThoughtId,
		loadThoughtsChronologically,
		thoughtsTable,
		type ThoughtInsert,
	} from '$lib/thoughts';
	import ThoughtDrop from './ThoughtDrop.svelte';
	import { m } from '$lib/paraglide/messages';

	$effect(() => {
		if (gs.db) {
			document.documentElement.classList.add('scrollbar-hidden');
			loadThoughtsChronologically({}).then(({ thoughts }) => {
				gs.feeds[''] = thoughts.map((t) => getThoughtId(t)).reverse();
				scrollToBottom();
				setTimeout(() => document.documentElement.classList.remove('scrollbar-hidden'), 0);
			});
		}
	});

	let deleteThought = async (tid: string) => {
		let [ms, by_id] = tid.split('_');
		await gs.db
			.delete(thoughtsTable)
			.where(
				and(
					by_id ? eq(thoughtsTable.by_id, by_id) : isNull(thoughtsTable.by_id),
					eq(thoughtsTable.ms, +ms),
				),
			);
		let newFeed = gs.feeds[''];
		newFeed?.splice(newFeed.indexOf(tid), 1);
		gs.feeds[''] = newFeed;
	};

	let addThought = async ({ tags, body }: { tags?: string[]; body?: string }) => {
		let ms = Date.now();
		await gs.db.insert(thoughtsTable).values({
			ms,
			tags,
			body,
		});
		let [thought] = await gs.db
			.select()
			.from(thoughtsTable)
			.where(and(eq(thoughtsTable.ms, ms), isNull(thoughtsTable.by_id)))
			.limit(1);

		let tid = getThoughtId(thought);
		gs.thoughts = { ...gs.thoughts, [tid]: thought };
		gs.feeds = { ...gs.feeds, ['']: [...(gs.feeds[''] || []), tid] };

		// console.log('gs.thoughts:', $state.snapshot(gs.thoughts));
		// console.log('gs', $state.snapshot(gs.feeds['']));
		// gs.feeds = clone(gs.feeds);
		// scrollToBottom();
	};

	$effect(() => {
		// console.log($state.snapshot(gs.feeds['']));
	});

	let isAtBottom = true;
	const checkScrollPosition = () => {
		isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight;
	};
	const handleResize = () => isAtBottom && scrollToBottom();
	onMount(() => {
		window.addEventListener('scroll', checkScrollPosition);
		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('scroll', checkScrollPosition);
			window.removeEventListener('resize', handleResize);
		};
	});
	let initialTags = $state([]);
	let initialBody = $state('');

	let feed = $derived(gs.feeds['']?.map((tid) => gs.thoughts[tid]).filter((t) => !!t));
</script>

<div class="flex-1 p-2 gap-2 min-h-screen flex flex-col">
	{#if !feed}
		<div class="text-fg2 my-2 text-lg text-center">{m.loading()}</div>
	{:else if !feed.length}
		<p class="my-2 text-xl text-center">{m.noThoughtsFound()}</p>
	{:else}
		{#each feed as thought}
			<ThoughtDrop {thought} />
		{/each}
	{/if}
	<ThoughtWriter {initialTags} {initialBody} onSubmit={(a) => addThought(a)} />
</div>
