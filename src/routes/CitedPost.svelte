<script lang="ts">
	import { getId, type PartInsert } from '$lib/types/parts';
	import BodyParser from './BodyParser.svelte';
	import PostHeader from './PostHeader.svelte';
	import Highlight from './Highlight.svelte';
	import type { Post } from '$lib/types/posts';
	let p: {
		post: Post;
		depth: number;
	} = $props();
	let parsed = $state(true);
	let id = $derived(getId(p.post));
</script>

<div
	class={`m${id} z-0 relative border-l-2 border-hl-cite p-1 pl-2 m-1 ${!(p.depth % 2) ? 'bg-bg1' : 'bg-bg3'}`}
>
	<Highlight {id} class="-left-0.5" />
	<PostHeader {...p} {parsed} onToggleParsed={() => (parsed = !parsed)} />
	<!-- {#if p.post.txt}
		{#if parsed}
			<BodyParser {...p} miniCites depth={p.depth + 1} />
		{:else}
			<pre>{p.post.txt}</pre>
		{/if}
	{/if} -->
</div>
