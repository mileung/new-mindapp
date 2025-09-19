<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { formatMs } from '$lib/time';
	import ThoughtHighlight from './ThoughtHighlight.svelte';
	let p: { id: string; depth: number; spotId?: string; toId?: string; editId?: string } = $props();
</script>

<a
	target="_blank"
	href={`/${p.id}`}
	class={`relative border-l-2 border-hl-cite p-1 m-1 w-fit block text-sm font-bold text-fg2 hover:text-fg1 ${!((p.depth + 1) % 2) ? 'bg-bg1' : 'bg-bg3'}`}
	onclick={(e) => {
		if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
			e.preventDefault();
			pushState(`/${p.id}`, { modalId: p.id, fromPathname: page.url.pathname });
		}
	}}
>
	<ThoughtHighlight {...p} class="-left-0.5" />
	{formatMs(+p.id.substring(0, p.id.indexOf('_')))}
</a>
