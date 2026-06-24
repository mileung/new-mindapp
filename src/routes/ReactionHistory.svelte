<script lang="ts">
	import { scrollToHighlight } from '$lib/dom';
	import {
		gs,
		mergeMsToAccountNameTxtMap,
		msToAccountItalic,
		msToAccountNameTxt,
		resetBottomOverlay,
	} from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { getIdObj, getIdStr } from '$lib/types/parts/partIds';
	import { getReactionHistory, reactionsPerLoad } from '$lib/types/reactions/getReactionHistory';
	import { IconChartBarPopular, IconX } from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import AccountIcon from './AccountIcon.svelte';
	import Highlight from './Highlight.svelte';

	let post = $derived(gs.showReactionHistory);
	let rxns = $derived(post ? gs.postIdToRxnsMap[getIdStr(post)] || [] : []);

	let loadMoreRxns = async (e: InfiniteEvent) => {
		if (!gs.accounts || gs.lastSeenInMs === undefined || !post) return;
		let lastRxn = rxns.at(-1);
		let rxnMsByMssExclude: { ms: number; by_ms: number }[] = [];
		for (let i = rxns.length - 1; i >= 0; i--) {
			let rxn = rxns[i];
			if (rxn.ms === lastRxn?.ms) rxnMsByMssExclude.push({ ms: rxn.ms, by_ms: rxn.by_ms });
			else break;
		}
		let res = await getReactionHistory({
			postIdObj: getIdObj(post),
			rxnMsByMssExclude,
			msLte: lastRxn?.ms || Number.MAX_SAFE_INTEGER,
		});
		rxns = [...rxns, ...res.reactions];
		e.detail.loaded();
		mergeMsToAccountNameTxtMap(res.msToAccountNameTxtMap);
		res.reactions.length < reactionsPerLoad ? e.detail.complete() : e.detail.loaded();
	};
</script>

{#if post}
	<div class="bg-bg3 flex flex-col h-[var(--h-post-writer)]">
		<div class="flex group bg-bg4 relative w-full">
			<button
				class="flex-1 h-8 pl-2 fx gap-1 truncate text-left"
				onclick={() => {
					let post = gs.showReactionHistory;
					post && scrollToHighlight(getIdStr(post), true);
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
		<div class="overflow-scroll overscroll-contain flex-1">
			{#each rxns || [] as rxn (getIdStr({ ...rxn, in_ms: post.in_ms }))}
				<div class="px-2 fx h-8">
					{rxn.emoji}
					<a href={`/__${post.by_ms}`} class="h-full fx px-2 group hover:text-fg1 hover:bg-bg6">
						<div class={`h-5 fx`}>
							<AccountIcon isUser ms={rxn.by_ms} class="mr-0.5 shrink-0 w-4" />
							<p class={`pr-1 ${msToAccountItalic(rxn.by_ms)}`}>
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
				on:infinite={loadMoreRxns}
			>
				<p slot="noMore" class="mb-2 text-lg text-fg2">{m.theEnd()}</p>
			</InfiniteLoading>
		</div>
	</div>
{/if}
