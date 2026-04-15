<script lang="ts">
	import type { Post } from '$lib/types/posts';
	import PostBlock from '../PostBlock.svelte';

	let { data }: { data: { post: Post } } = $props();
</script>

<PostBlock isEmbed depth={0} post={data.post} />
