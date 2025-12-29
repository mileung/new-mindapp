<script lang="ts">
	import { type Post } from '$lib/types/posts';
	import PostBlock from './PostBlock.svelte';
	let p: {
		post: Post;
		depth: number;
	} = $props();
</script>

<div
	class={`relative z-0 border-l-2 border-bg8 pl-2 my-1 -mr-1 ${!(p.depth % 2) ? 'bg-bg1' : 'bg-bg2'}`}
>
	<PostBlock {...p} cited />
</div>
