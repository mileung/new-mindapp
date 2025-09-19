<script lang="ts">
	import { page } from '$app/state';
	import { IconX } from '@tabler/icons-svelte';
	import Feed from '../Feed.svelte';
	import { isId, parseId } from '$lib/thoughts';
	import { goto } from '$app/navigation';
	import { gs } from '$lib/globalState.svelte';

	let searchedText = $derived(page.url.searchParams.get('q') || '');

	let feedId = $derived(isId(page.params.feed) && page.params.feed);
	let feedIdSegs = $derived(feedId ? parseId(feedId) : null);
	let spotId = $derived(feedIdSegs?.ms ? page.params.feed : undefined);

	$effect(() => {
		// console.log(page.params, page.params.feed, isId(page.params.feed));
		// console.log(page.state.modalId);
		// console.log('spotId:', spotId);
		// console.log('feedId:', feedId);
		!feedId &&
			gs.accounts[0] &&
			goto(
				`/__${(() => {
					let spaceId = gs.accounts[0]?.spaceIds[gs.accounts[0]?.spaceIndex];
					return typeof spaceId === 'number' ? spaceId : '';
				})()}`,
				{ keepFocus: true },
			);
	});
</script>

{#if page.state.modalId}
	<Feed modal {searchedText} spotId={page.state.modalId} />
{/if}
<div class={page.state.modalId ? 'hidden' : ''}>
	<Feed {searchedText} {spotId} />
</div>
