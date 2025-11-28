<script lang="ts">
	import { getIdStr } from '$lib/types/parts/partIds';
	import { type Post } from '$lib/types/posts';
	import PostBlock from './PostBlock.svelte';
	let p: {
		post: Post;
		depth: number;
	} = $props();
	let id = $derived(getIdStr(p.post));
	// $effect(() => {
	// 	console.log('p:', p);
	// });
</script>

<div
	class={`m${id} z-0 relative border-l-2 border-hl-cite p-1 pl-2 m-1 ${!(p.depth % 2) ? 'bg-bg1' : 'bg-bg3'}`}
>
	<PostBlock {...p} miniCites />
</div>
