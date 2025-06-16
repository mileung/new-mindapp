<script lang="ts">
	import { gs } from '$lib/globalState.svelte';
	import { isRecord, isStringifiedRecord } from '$lib/js';
	import { isThoughtId, type ThoughtSelect } from '$lib/thoughts';
	import Markdown from './Markdown.svelte';
	import MentionedThought from './MentionedThought.svelte';
	import MiniMentionedThought from './MiniMentionedThought.svelte';

	const p: { miniMentions?: boolean; thought: ThoughtSelect } = $props();

	const thoughtIdsRegex = /(^|\s)\d{9,}_(|[A-HJ-NP-Za-km-z1-9]{9,})_(|[\w:\.-]{3,})($|\s)/g;
	function separateMentions(text: string) {
		const matches = text.matchAll(thoughtIdsRegex);
		const result: string[] = [];
		let start = 0;
		for (const match of matches) {
			result.push(text.substring(start, match.index), match[0]);
			start = match.index! + match[0].length;
		}
		if (start < text.length) {
			result.push(text.substring(start));
		}
		return result;
	}

	let bodySegs = $derived(separateMentions(p.thought.body || ''));
	$effect(() => {
		// console.log(bodySegs);
	});
</script>

{#each bodySegs as str, i}
	{#if i % 2}
		{#if p.miniMentions}
			<MiniMentionedThought thoughtId={str} />
		{:else if gs.thoughts[str]}
			<MentionedThought thought={gs.thoughts[str]} />
		{:else}
			<p class="break-words">{str}</p>
		{/if}
	{:else if isStringifiedRecord(str)}
		<pre>{JSON.stringify(JSON.parse(str), null, 2)}</pre>
	{:else}
		<!-- // remove the first new line cuz the mentioned thought has block display -->
		<!-- {parseMd(i ? str.replace(/^\n/, '') : str)} -->
		<!-- <Markdown text={i ? str.replace(/^\n/, '') : str} /> -->
		<Markdown text={str} />
	{/if}
{/each}
