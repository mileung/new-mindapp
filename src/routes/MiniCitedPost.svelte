<script lang="ts">
	import { formatMs } from '$lib/time';
	import { getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import Highlight from './Highlight.svelte';
	let p: { postId: string; depth: number } = $props();
	let evenBg = $derived(!(p.depth % 2));
</script>

<a
	href={'/' + p.postId}
	class={`relative border-l-2 border-hl-cite p-1 m-1 w-fit block text-sm font-bold text-fg2 hover:text-fg1 ${evenBg ? 'bg-bg1 hover:bg-bg4' : 'bg-bg2 hover:bg-bg5'}`}
	title={formatMs(getIdStrAsIdObj(p.postId).ms, true)}
>
	<Highlight {...p} {evenBg} class="-left-0.5" />
	{formatMs(getIdStrAsIdObj(p.postId).ms)}
</a>
