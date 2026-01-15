<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { getUrlInMs } from '$lib/types/parts/partIds';
	import { getPromptSigningIn, spaceMsToName } from '$lib/types/spaces';
	import { getSpaceTags, tagsPerLoad } from '$lib/types/spaces/getSpaceTags';
	import { IconSquare, IconSquareCheckFilled } from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import Apush from '../../Apush.svelte';
	import PromptSignIn from '../../PromptSignIn.svelte';

	let urlInMs = $derived(getUrlInMs());
	// let numTags = $state(0);
	let tags = $state<
		{
			txt: string;
			num: number;
		}[]
	>([]);

	$effect(() => {
		urlInMs;
		tags = [];
	});

	let loadMoreTags = async (e: InfiniteEvent) => {
		if (!gs.accounts || gs.currentSpaceMs === undefined) return;
		let lastCount = tags.slice(-1)[0]?.num || Number.MAX_SAFE_INTEGER;
		let lastTagsWithSameCount: string[] = [];
		for (let i = tags.length - 1; i >= 0; i--) {
			let tag = tags[i];
			if (tag.num === lastCount) lastTagsWithSameCount.push(tag.txt!);
			else break;
		}
		let res = await getSpaceTags(lastCount, lastTagsWithSameCount);
		tags = [...tags, ...res.tags];
		let endReached = res.tags.length < tagsPerLoad;
		if (endReached) {
			e.detail.complete();
			// numTags = tags.length;
		} else {
			// numTags = res.tagCount;
			e.detail.loaded();
		}
	};

	let savedTags = $derived(
		new Set(
			gs.accounts //
				? (JSON.parse(gs.accounts[0].savedTags.txt) as string[])
				: [],
		),
	);
</script>

{#if urlInMs === undefined}
	<!--  -->
{:else if getPromptSigningIn()}
	<PromptSignIn />
{:else}
	<div class="p-2 w-full max-w-lg">
		<p class="text-xl font-bold">
			<!-- {numTags === 1
				? m.oneSpaceNameTag({ spaceName: spaceMsToName(urlInMs) })
				: m.nSpaceNameTags({ n: numTags, spaceName: spaceMsToName(urlInMs) })} -->
			{m.spaceNameTags({ spaceName: spaceMsToName(urlInMs).txt })}
		</p>
		{#each tags || [] as tag, i (tag.txt)}
			<div class="flex text-lg">
				{tag.num} -
				<!-- use Apush here? -->
				<Apush
					href={`/__${gs.currentSpaceMs}?q=${encodeURIComponent(`[${tag.txt}]`)}`}
					class="px-1 font-bold hover:underline hover:bg-bg3"
				>
					{tag.txt}
				</Apush>
				<button
					class="group flex-1 hover:bg-bg3 pr-1"
					onclick={() => updateSavedTags([tag.txt], savedTags.has(tag.txt))}
				>
					<IconSquare class={`ml-auto w-5 ${savedTags.has(tag.txt) ? 'hidden' : 'block'}`} />
					<IconSquareCheckFilled
						class={`ml-auto w-5 ${savedTags.has(tag.txt) ? 'block' : 'hidden'}`}
					/>
				</button>
			</div>
		{/each}
		<InfiniteLoading identifier={urlInMs} spinner="spiral" on:infinite={loadMoreTags}>
			<p slot="noResults" class="m-2 text-lg text-fg2">
				{m.noTagsFound()}
			</p>
			<p slot="noMore" class="m-2 text-lg text-fg2">{m.endOfList()}</p>
			<p slot="error" class="m-2 text-lg text-fg2">
				{m.placeholderError()}
			</p>
		</InfiniteLoading>
	</div>
{/if}
