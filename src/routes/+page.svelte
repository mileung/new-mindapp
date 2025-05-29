<script lang="ts">
	import { thoughtsTable } from '$lib';
	import { scrollToBottom } from '$lib/dom';
	import { gs } from '$lib/globalState.svelte';
	import { desc } from 'drizzle-orm';
	import { onMount } from 'svelte';

	onMount(async () => {
		scrollToBottom();
	});

	// afterUpdate(() => {
	//   window.scrollTo(0, document.body.scrollHeight);
	// });

	let ta: HTMLTextAreaElement;
	let ipt: HTMLInputElement;
</script>

<!-- <div class="b xy h-screen"><p class="text-6xl">test</p></div> -->
<div class="">
	{#if !gs.feeds['']}
		<div class="">loading</div>
	{:else}
		{#each gs.feeds[''] as thought}
			<div class="b h-26">{thought.body}</div>
		{/each}
	{/if}
</div>
<div class="b mb-12 sticky bg-bg1 bottom-0 w-full p-2">
	<textarea
		bind:this={ta}
		class="border-fg3 block w-full resize-none rounded-t border-1 p-2 text-xl focus:outline-none"
		placeholder="Thought"
		onkeydown={async (e) => {
			if (e.metaKey && e.key === 'Enter') {
				await gs.db.insert(thoughtsTable).values({
					ms: Date.now(),
					body: ta.value,
				});
				ta.value = '';
				let [thought] = await gs.db
					.select()
					.from(thoughtsTable)
					.orderBy(desc(thoughtsTable.ms))
					.limit(1);
				gs.feeds[''] = gs.feeds[''] || [];
				gs.feeds[''].push(thought);
				scrollToBottom();
			}
		}}
	></textarea>
	<input
		bind:this={ipt}
		class="border-fg3 w-full rounded-b border-1 border-t-0 p-2 text-xl focus:outline-none"
		placeholder="Tags"
	/>
</div>
