<script lang="ts">
	import { page } from '$app/state';
	import { getUrlInMs, isIdStr } from '$lib/types/parts/partIds';
	import Feed from '../Feed.svelte';

	let qSearchParam = $derived(page.url.searchParams.get('q') || '');
	let postIdStr = $derived(
		page.state.postIdStr ||
			(isIdStr(page.params.tid)
				? page.params.tid //
				: undefined),
	);
	let useModal = $derived(!!(qSearchParam || postIdStr));
	let urlInMs = $derived(getUrlInMs());
</script>

{#if urlInMs !== undefined}
	{#if useModal}
		<Feed modal {qSearchParam} tidStr={postIdStr} />
	{/if}
	<Feed {qSearchParam} hidden={useModal} tidStr={`__${urlInMs}`} />
{/if}
