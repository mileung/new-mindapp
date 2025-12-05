<script lang="ts">
	import { getIdStr } from '$lib/types/parts/partIds';
	import { type Post } from '$lib/types/posts';
	import PostBlock from './PostBlock.svelte';
	let p: {
		post: Post;
		depth: number;
	} = $props();
	let postId = $derived(getIdStr(p.post));
	// $effect(() => {
	// 	console.log('p:', p);
	// });
</script>

<div
	class={`relative z-0 border-l-2 border-hl-cite pl-2 my-1 -mr-1 ${!(p.depth % 2) ? 'bg-bg1' : 'bg-bg2'}`}
>
	<PostBlock {...p} cited />
</div>
