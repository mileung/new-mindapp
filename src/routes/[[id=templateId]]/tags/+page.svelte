<script lang="ts">
	import { page } from '$app/state';
	import { spaceMsToSpaceName } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { getSplitId } from '$lib/types/parts';
	import {
		IconCrown,
		IconSearch,
		IconStar,
		IconStarOff,
		IconUserMinus,
		IconUsersPlus,
	} from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import AccountIcon from '../../AccountIcon.svelte';
	import { identikana, strIsInt } from '$lib/js';

	let split = $derived(getSplitId(page.params.id || ''));
	let created = $derived(formatMs(split.ms!));

	let searchIpt: HTMLInputElement;
	let searchVal = $state('');
	let tags = $state<number[]>([]);

	let loadMoreTags = async (e: InfiniteEvent) => {
		tags = [
			//
			...Array(19),
		].map(() => +('' + Math.random()).slice(2));
		let newFromMs = 0; //lastRoot?.ms;
		let endReached = true; //rootPosts.length < postsPerLoad;
		e.detail.loaded();
		endReached ? e.detail.complete() : e.detail.loaded();
	};
</script>

<div class="xy min-h-screen p-5">
	<div class="w-full max-w-sm">
		<div class="text-xl font-bold">
			<p class="text-3xl font-black">
				{spaceMsToSpaceName(null)} tags
			</p>
			<div class="mt-2 bg-bg2 min-w-0 flex h-9">
				<input
					bind:this={searchIpt}
					bind:value={searchVal}
					enterkeyhint="search"
					class="min-w-0 flex-1 pl-2 pr-10"
					placeholder={m.search()}
					onkeydown={(e) => {}}
				/>
				<a
					class="xy -ml-10 w-10 text-fg2 hover:text-fg1"
					href={`/?q=${encodeURIComponent(searchVal)}`}
				>
					<IconSearch class="h-6 w-6" />
				</a>
			</div>
			{#each tags || [] as ms, i}
				<div class="">{i} {ms}</div>
			{/each}
			<InfiniteLoading identifier={'identifier'} spinner="spiral" on:infinite={loadMoreTags}>
				<p slot="noMore" class="mb-2 text-xl text-fg2">{m.endOfList()}</p>
				<p slot="error" class="mb-2 text-xl text-fg2">{m.anErrorOccurred()}</p>
			</InfiniteLoading>
		</div>
	</div>
</div>
