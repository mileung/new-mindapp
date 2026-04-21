<script lang="ts">
	import {
		getPromptSigningIn,
		getUrlInMsContext,
		gs,
		msToSpaceNameTxt,
	} from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { getUrlInMs } from '$lib/types/parts/partIds';
	import { getSpaceTags, tagsPerLoad } from '$lib/types/spaces/getSpaceTags';
	import { IconSquare, IconSquareCheckFilled } from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import PromptSignIn from '../../PromptSignIn.svelte';

	let urlInMs = $derived(getUrlInMs());
	let space = $derived(gs.msToSpaceMap[urlInMs || -1]);
	let spaceContext = $derived(getUrlInMsContext());
	let viewable = $derived(space?.isPublic.num || spaceContext?.permissionCode);
	let tagsData = $derived(gs.spaceMsToTagsMap[urlInMs || -1]);
	let tags = $derived(tagsData?.tags || []);

	let loadMoreTags = async (e: InfiniteEvent) => {
		if (!gs.accounts || urlInMs === undefined) return;
		if (tagsData?.endReached) {
			tags.length && e.detail.loaded();
			return e.detail.complete();
		}
		let lastCount = tags.slice(-1)[0]?.num || Number.MAX_SAFE_INTEGER;
		let lastTagsWithSameCount: string[] = [];
		for (let i = tags.length - 1; i >= 0; i--) {
			let tag = tags[i];
			if (tag.num === lastCount) lastTagsWithSameCount.push(tag.txt!);
			else break;
		}
		let res = await getSpaceTags(lastCount, lastTagsWithSameCount);
		console.log('getSpaceTags res', res);
		if (tags.length) e.detail.loaded();
		let endReached = res.tags.length < tagsPerLoad;
		if (endReached) e.detail.complete();
		gs.spaceMsToTagsMap = {
			...gs.spaceMsToTagsMap,
			[urlInMs]: {
				endReached,
				tags: [...tags, ...res.tags],
			},
		};
	};

	let savedTagsSet = $derived(
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
				? m.oneSpaceNameTag({ spaceName: spaceMsToName(lastSeenInMs) })
				: m.nSpaceNameTags({ n: numTags, spaceName: spaceMsToName(lastSeenInMs) })} -->
			{m.spaceNameTags({ spaceName: msToSpaceNameTxt(urlInMs) })}
		</p>
		{#each tags || [] as tag, i (tag.txt)}
			<div class="flex text-lg">
				{tag.num} -
				<a
					href={`/__${urlInMs}?q=${`[${tag.txt}]`}`}
					class="px-1 font-bold hover:underline hover:bg-bg3"
				>
					{tag.txt}
				</a>
				<button
					class="group flex-1 hover:bg-bg3 pr-1"
					onclick={() => updateSavedTags([tag.txt], savedTagsSet.has(tag.txt))}
				>
					<IconSquare class={`ml-auto w-5 ${savedTagsSet.has(tag.txt) ? 'hidden' : 'block'}`} />
					<IconSquareCheckFilled
						class={`ml-auto w-5 ${savedTagsSet.has(tag.txt) ? 'block' : 'hidden'}`}
					/>
				</button>
			</div>
		{/each}
		{#if viewable}
			<InfiniteLoading identifier={urlInMs} spinner="spiral" on:infinite={loadMoreTags}>
				<p slot="noResults" class="m-2 text-lg text-fg2">
					{m.noTagsFound()}
				</p>
				<p slot="noMore" class="m-2 text-lg text-fg2">{m.theEnd()}</p>
				<p slot="error" class="m-2 text-lg text-fg2">
					{m.placeholderError()}
				</p>
			</InfiniteLoading>
		{/if}
	</div>
{/if}
