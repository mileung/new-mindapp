<script lang="ts">
	import { page } from '$app/state';
	import { getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import Feed from '../Feed.svelte';

	let qSearchParam = $derived(page.url.searchParams.get('q') || '');
	let idParam = $derived(page.state.modalId || page.params.id!);
	let useModal = $derived(!!qSearchParam || !idParam.startsWith('__'));
	let idParamObj = $derived(getIdStrAsIdObj(idParam));
</script>

{#if idParam}
	{#if useModal}
		<Feed modal {qSearchParam} {idParam} />
	{/if}
	<Feed {qSearchParam} hidden={useModal} idParam={`__${idParamObj.in_ms}`} />
{/if}
