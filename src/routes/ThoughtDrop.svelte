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
		linking,
		// onDelete,
		// onEdit,
		onLink,
	}: {
		thought: ThoughtSelect;
		linking?: boolean;
		// onDelete: () => void;
		// onEdit: () => void;
		onLink: () => void;
	} = $props();
	// let id = $derived(getThoughtId(thought));
	// let when = $derived(formatMs(thought.ms));
	let parsed = $state(true);
	let id = $derived(getThoughtId(thought));
</script>

<div {id} class="relative bg-bg2 p-1 rounded">
	{#if linking}
		<!-- <div class="b z-50 pointer-events-none absolute inset-0 bg-hl1/5"></div> -->
	{/if}
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
			onLink();
		}}
	/>
	{#if thought.body}
		<div>
			{#if parsed}
				<BodyParser {thought} />
			{:else}
				<pre>{thought.body}</pre>
			{/if}
		</div>
	{/if}
</div>
