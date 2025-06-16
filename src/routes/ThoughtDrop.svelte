<script lang="ts">
	import { gs } from '$lib/globalState.svelte';
	import { isStringifiedRecord } from '$lib/js';
	import { getThoughtId, type ThoughtSelect } from '$lib/thoughts';
	import { formatMs } from '$lib/time';
	import { onMount } from 'svelte';
	import BodyParser from './BodyParser.svelte';
	import ThoughtHeader from './ThoughtHeader.svelte';

	let {
		thought,
		// onDelete,
		// onEdit,
		// onLink,
	}: {
		thought: ThoughtSelect;
		// onDelete: () => void;
		// onEdit: () => void;
		// onLink: () => void;
	} = $props();
	let id = $derived(getThoughtId(thought));
	let when = $derived(formatMs(thought.ms));
	let parsed = $state(true);
</script>

<div class="bg-bg2 p-1 rounded">
	<ThoughtHeader
		{thought}
		{parsed}
		onShowMoreBlur={() => {
			//
		}}
		onToggleParsed={() => (parsed = !parsed)}
		onEdit={() => {
			//
		}}
		onLink={() => {
			//
		}}
	/>
	{#if thought.body}
		<!-- TODO Get scroll chaining to work in Brave -->
		<!-- <div class="max-h-[85vh] mini-scroll"> -->
		<div>
			{#if parsed}
				<BodyParser {thought} />
			{:else}
				<pre>{thought.body}</pre>
			{/if}
		</div>
	{/if}
</div>
