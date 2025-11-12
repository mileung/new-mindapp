<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { isStringifiedRecord } from '$lib/js';
	import { idsRegex, type PartInsert } from '$lib/types/parts';
	import type { Post } from '$lib/types/posts';
	import CitedPost from './CitedPost.svelte';
	import Markdown from './Markdown.svelte';
	import MiniCitedPost from './MiniCitedPost.svelte';

	let p: {
		body: string;
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
	let bodySegs = $derived(separateMentions(p.body));
	// $effect(() => {
	// 	console.log(bodySegs);
	// });
</script>

{#each bodySegs as str, i}
	{#if i % 2}
		{#if p.miniCites}
			<MiniCitedPost {...p} id={str} depth={p.depth + 1} />
		{:else if gs.posts[str]}
			<CitedPost {...p} post={gs.posts[str]} depth={p.depth + 1} />
		{:else}
			<p>{str}</p>
		{/if}
	{:else if isStringifiedRecord(str)}
		<pre>{JSON.stringify(JSON.parse(str), null, 2)}</pre>
	{:else}
		<Markdown text={str} />
	{/if}
{/each}
