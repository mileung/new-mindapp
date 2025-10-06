<script lang="ts">
	import { getId, type ThoughtInsert } from '$lib/types/thoughts';
	import BodyParser from './BodyParser.svelte';
	import ThoughtHeader from './ThoughtHeader.svelte';
	import Highlight from './Highlight.svelte';
	let p: {
		thought: ThoughtInsert;
		depth: number;
	} = $props();
	let parsed = $state(true);
	let id = $derived(getId(p.thought));
</script>

<div
	class={`m${id} z-0 relative border-l-2 border-hl-cite p-1 pl-2 m-1 ${!(p.depth % 2) ? 'bg-bg1' : 'bg-bg3'}`}
>
	<Highlight {id} class="-left-0.5" />
	<ThoughtHeader {...p} {parsed} onToggleParsed={() => (parsed = !parsed)} />
	{#if p.thought.body}
		{#if parsed}
			<BodyParser {...p} miniCites depth={p.depth + 1} />
		{:else}
			<pre>{p.thought.body}</pre>
		{/if}
	{/if}
</div>
