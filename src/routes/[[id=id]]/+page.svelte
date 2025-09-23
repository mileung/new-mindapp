<script lang="ts">
	import { page } from '$app/state';
	import Feed from '../Feed.svelte';

	let searchedText = $derived(page.url.searchParams.get('q') || '');
	let idParam = $derived(page.state.modalId || page.params.id);
</script>

{#if page.url.pathname === '/' || idParam}
	{#if page.state.modalId}
		<Feed modal {searchedText} {idParam} />
	{/if}
	<div class={page.state.modalId ? 'hidden' : ''}>
		<Feed hidden={!!page.state.modalId} {searchedText} {idParam} />
	</div>
{/if}
