<script lang="ts">
	import { thoughtsTable, type SelectThought } from '$lib';
	import { scrollToBottom } from '$lib/dom';
	import { gs } from '$lib/globalState.svelte';
	import { and, desc, eq, isNull } from 'drizzle-orm';
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	let loadThoughts = async () => {
		let thoughts = await gs.db.select().from(thoughtsTable).orderBy(thoughtsTable.ms).all();
		const newThoughts = { ...gs.thoughts };
		thoughts.forEach((t) => (newThoughts[getThoughtId(t)] = t));
		gs.thoughts = newThoughts;
		gs.feeds[''] = thoughts.map((t) => getThoughtId(t));
		scrollToBottom();
	};

	$effect(() => {
		if (gs.db) {
			loadThoughts();
			console.log('hi');
		}
	});

	let ta: HTMLTextAreaElement;
	let ipt: HTMLInputElement;

	let taVal = $state('');

	export function getThoughtId(thought: SelectThought) {
		return `${thought.ms}_${thought.by_id || ''}`;
	}

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
	let saveThought = async () => {
		await gs.db.insert(thoughtsTable).values({
			ms: Date.now(),
			body: ta.value,
		});
		taVal = '';
		let [thought] = await gs.db
			.select()
			.from(thoughtsTable)
			.orderBy(desc(thoughtsTable.ms))
			.limit(1);
		gs.feeds[''] ??= [];
		let tid = getThoughtId(thought);
		gs.thoughts[tid] = thought;
		gs.feeds[''].push(tid);
		scrollToBottom();
	};
</script>

<!-- <div class="b xy h-screen"><p class="text-6xl">test</p></div> -->
<div class="">
	{#if !gs.feeds['']}
		<div class="">loading</div>
	{:else}
		{#each gs.feeds[''] as tid}
			<div class="b">
				<p class="whitespace-pre-wrap break-words inline font-medium">{gs.thoughts[tid].body}</p>
				<button class="mt-4 cursor-pointer xy b h-8 w-8" onclick={() => deleteThought(tid)}>
					<Icon name="trash" class="text-hl1 h-5 w-5" />
				</button>
			</div>
		{/each}
	{/if}
</div>
<div class="b mb-12 sticky bg-bg1 bottom-0 w-full p-2">
	<div class="relative">
		<textarea
			bind:this={ta}
			bind:value={taVal}
			placeholder="Share thought"
			class="border-fg3 block w-full resize-none rounded-t border-1 p-2 text-xl pr-12 focus:outline-none"
			onkeydown={async (e) => {
				if (e.metaKey && e.key === 'Enter') {
					saveThought();
				}
			}}
			>...................................................................................................................................................................................................................................................................................................................................................................................
		</textarea>
		{#if taVal}
			<button class="cursor-pointer xy b h-8 w-8 absolute bottom-2 right-2" onclick={saveThought}>
				<Icon name="arrow-up" class="text-hl1 h-5 w-5" />
			</button>
		{/if}
	</div>
	<input
		bind:this={ipt}
		class="border-fg3 w-full rounded-b border-1 border-t-0 p-2 text-xl focus:outline-none"
		placeholder="Tags"
	/>
</div>
