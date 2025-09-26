<script lang="ts">
	import { page } from '$app/state';
	import Feed from '../Feed.svelte';

	let searchedText = $derived(page.url.searchParams.get('q') || '');
	let idParam = $derived(page.state.modalId || page.params.id || '');
	let useModal = $derived(page.state.modalId || searchedText || !idParam.startsWith('__'));
</script>

{#if page.url.pathname === '/' || idParam}
	{#if useModal}
		<Feed modal {searchedText} {idParam} />
	{/if}
	<div class={useModal ? 'hidden' : ''}>
		<Feed hidden={!!page.state.modalId} {idParam} searchedText="" />
	</div>
{/if}
