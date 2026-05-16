<script lang="ts">
	import { scrollToHighlight } from '$lib/dom';
	import { gs, msToAccountNameTxt, resetBottomOverlay } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { getIdObj, getIdStr, type IdObj } from '$lib/types/parts/partIds';
	import type { Reaction } from '$lib/types/reactions';
	import { getReactionHistory, reactionsPerLoad } from '$lib/types/reactions/getReactionHistory';
	import { IconChartBarPopular, IconX } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import AccountIcon from './AccountIcon.svelte';
	import Highlight from './Highlight.svelte';

	let post = $derived(gs.showReactionHistory);
	onMount(() => {
		// console.log('test', gs.showReactionHistory);
	});

	let reactions = $state<Reaction[]>([]);

	$effect(() => {
		reactions = [];
	});

	let loadMoreReactions = async (e: InfiniteEvent) => {
		if (!gs.accounts || gs.lastSeenInMs === undefined || !post) return;
		let lastRxn = reactions.slice(-1)[0];
		let rxnIdObjsExclude: IdObj[] = [];
		for (let i = reactions.length - 2; i >= 0; i--) {
			let rxn = reactions[i];
			if (rxn.ms === lastRxn.ms) rxnIdObjsExclude.push(getIdObj(rxn));
			else break;
		}
		let res = await getReactionHistory({
			postIdObj: post,
			rxnIdObjsExclude,
			msBefore: lastRxn ? lastRxn.ms + 1 : Number.MAX_SAFE_INTEGER,
		});
		reactions = [...reactions, ...res.reactions];
		e.detail.loaded();

		res.reactions.length < reactionsPerLoad ? e.detail.complete() : e.detail.loaded();
	};
</script>

{#if post}
	<div class="bg-bg3 h-[var(--h-post-writer)]">
		<div class="flex group bg-bg4 relative w-full">
			<!-- TODO: save writer data so it persists after page refresh. If the post it's editing or linking to is not on the feed, open it in a modal? -->
			<button
				class="flex-1 h-8 pl-2 fx gap-1 truncate text-left"
				onclick={() => {
					let post = gs.showReactionHistory;
					post && scrollToHighlight(getIdStr(post));
				}}
			>
				<IconChartBarPopular class="w-5" />
				<p class="flex-1 truncate">
					{m.reactions()}
				</p>
			</button>
			<button class="w-8 xy hover:bg-bg7 hover:text-fg3" onclick={() => resetBottomOverlay()}>
				<IconX class="w-5" />
			</button>
			<Highlight noScrollId postIdStr={getIdStr(post)} />
		</div>
		{#each reactions || [] as rxn, i (getIdStr(rxn))}
			<div class="px-1 flex">
				{rxn.emoji}
				<a
					href={`/_${post.by_ms}_`}
					class={`fx px-1 group hover:text-fg1 hover:bg-bg6 ${gs.msToProfileMap[rxn.by_ms]?.name.txt ? '' : 'italic'}`}
				>
					<div class={`h-5 fx`}>
						<AccountIcon isUser ms={post.by_ms} class="mr-0.5 shrink-0 w-4" />
						<p class="pr-1">
							{msToAccountNameTxt(rxn.by_ms)}
						</p>
					</div>
				</a>
				<p class="text-fg2">{formatMs(rxn.ms)}</p>
			</div>
		{/each}
		<InfiniteLoading
			identifier={getIdStr(gs.showReactionHistory!)}
			spinner="spiral"
			on:infinite={loadMoreReactions}
		>
			<p slot="noMore" class="mb-2 text-lg text-fg2">{m.theEnd()}</p>
		</InfiniteLoading>
	</div>
{/if}
