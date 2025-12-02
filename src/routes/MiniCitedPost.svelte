<script lang="ts">
	import { pushState } from '$app/navigation';
	import { formatMs } from '$lib/time';
	import Highlight from './Highlight.svelte';
	let p: { id: string; depth: number } = $props();
	let evenBg = $derived(!(p.depth % 2));
</script>

<a
	target="_blank"
	href={'/' + p.id}
	class={`relative border-l-2 border-hl-cite p-1 m-1 w-fit block text-sm font-bold text-fg2 hover:text-fg1 ${evenBg ? 'bg-bg1 hover:bg-bg4' : 'bg-bg2 hover:bg-bg5'}`}
	onclick={(e) => {
		if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
			e.preventDefault();
			pushState('/' + p.id, { modalId: p.id });
		}
	}}
>
	<Highlight {...p} {evenBg} class="-left-0.5" />
	{formatMs(+p.id.substring(0, p.id.indexOf('_')))}
</a>
