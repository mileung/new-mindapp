<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { isStringifiedRecord } from '$lib/js';
	import { idsRegex, type ThoughtInsert } from '$lib/thoughts';
	import CitedThought from './CitedThought.svelte';
	import Markdown from './Markdown.svelte';
	import MiniCitedThought from './MiniCitedThought.svelte';

	let p: {
		thought: ThoughtInsert;
		depth: number;
		miniCites?: boolean;
	} = $props();

	function separateMentions(text: string) {
		let matches = text.matchAll(idsRegex);
		let result: string[] = [];
		let start = 0;
		for (let match of matches) {
			result.push(text.substring(start, match.index), match[0]);
			start = match.index + match[0].length;
		}
		start < text.length && result.push(text.substring(start));
		return result.map((s) => s.trim());
	}
	let bodySegs = $derived(separateMentions(p.thought.body || ''));
	// $effect(() => {
	// 	console.log(bodySegs);
	// });
</script>

{#each bodySegs as str, i}
	{#if i % 2}
		{#if p.miniCites}
			<MiniCitedThought {...p} id={str} depth={p.depth + 1} />
		{:else if gs.thoughts[str]}
			<CitedThought {...p} thought={gs.thoughts[str]} depth={p.depth + 1} />
		{:else}
			<p>{str}</p>
		{/if}
	{:else if isStringifiedRecord(str)}
		<pre>{JSON.stringify(JSON.parse(str), null, 2)}</pre>
	{:else}
		<Markdown text={str} />
		<!-- <div class="prose max-w-none dark:prose-invert">
			<SvelteMarkdown source={str.replace(/\n/g, '\n\n')} renderers={{ link: MarkdownLink }} />
		</div> -->
	{/if}
{/each}
