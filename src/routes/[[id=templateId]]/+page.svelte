<script lang="ts">
	import { page } from '$app/state';
	import Feed from '../Feed.svelte';

	let qSearchParam = $derived(page.url.searchParams.get('q') || '');
	let idParam = $derived(page.state.modalId || page.params.id || '');
	let useModal = $derived(!!(page.state.modalId || qSearchParam || !idParam.startsWith('__')));
	console.log('page.url.pathname:', page.url.pathname);
</script>

{#if page.url.pathname === '/' || idParam}
	{#if useModal}
		<Feed modal {qSearchParam} {idParam} />
	{/if}
	<Feed {qSearchParam} hidden={useModal} idParam={page.params.id} />
{/if}
