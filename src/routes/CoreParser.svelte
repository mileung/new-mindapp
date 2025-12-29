<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { isStringifiedRecord } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { idsRegex } from '$lib/types/parts/partIds';
	import CitedPost from './CitedPost.svelte';
	import Markdown from './Markdown.svelte';
	import MiniCitedPost from './MiniCitedPost.svelte';

	let p: {
		core: string;
		depth: number;
		miniCites?: boolean;
	} = $props();

	let separateCites = (text: string) => {
		let matches = text.matchAll(idsRegex);
		let result: string[] = [];
		let start = 0;
		for (let match of matches) {
			result.push(text.substring(start, match.index), match[0]);
			start = match.index + match[0].length;
		}
		start < text.length && result.push(text.substring(start));
		return result.map((s) => s.trim());
	};
	let coreSegs = $derived(separateCites(p.core));
	// $effect(() => {
	// 	console.log(coreSegs);
	// });
</script>

{#each coreSegs as str, i}
	{#if i % 2}
		{#if p.miniCites}
			<MiniCitedPost {...p} postIdStr={str} depth={p.depth + 1} />
		{:else if gs.idToPostMap[str]}
			<CitedPost {...p} post={gs.idToPostMap[str]} depth={p.depth + 1} />
		{:else}
			<div class={`bg-bg1 text-sm font-bold text-fg2`}>{m.idNotFound({ id: str })}</div>
		{/if}
	{:else if isStringifiedRecord(str)}
		<pre>{JSON.stringify(JSON.parse(str), null, 2)}</pre>
	{:else}
		<Markdown text={str} />
	{/if}
{/each}
