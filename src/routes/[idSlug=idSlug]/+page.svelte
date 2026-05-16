<script lang="ts">
	import { page } from '$app/state';
	import PostFeed from '../PostFeed.svelte';

	$effect(() => {
		console.log('page.params.idSlug:', page.params.idSlug);
	});
</script>

{#key 'is'}
	<PostFeed />
{/key}
