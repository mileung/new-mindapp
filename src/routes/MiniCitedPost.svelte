<script lang="ts">
	import { formatMs } from '$lib/time';
	import { getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import Apush from './Apush.svelte';
	import Highlight from './Highlight.svelte';
	let p: { postIdStr: string; depth: number } = $props();
	let evenBg = $derived(!(p.depth % 2));
</script>

<Apush
	href={'/' + p.postIdStr}
	class={`relative border-l-2 border-bg8 p-1 m-1 w-fit block text-sm font-bold text-fg2 hover:text-fg1 ${evenBg ? 'bg-bg1 hover:bg-bg4' : 'bg-bg2 hover:bg-bg4'}`}
	title={formatMs(getIdStrAsIdObj(p.postIdStr).ms, 'min')}
>
	<Highlight {...p} {evenBg} class="-left-0.5" />
	{formatMs(getIdStrAsIdObj(p.postIdStr).ms)}
</Apush>
