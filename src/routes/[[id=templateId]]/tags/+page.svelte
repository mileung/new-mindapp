<script lang="ts">
	import { page } from '$app/state';
	import { gs, spaceMsToSpaceName } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import { getPromptSigningIn } from '$lib/types/spaces';
	import { getSpaceTags, tagsPerLoad } from '$lib/types/spaces/getSpaceTags';
	import { IconSquare, IconSquareCheckFilled } from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import PromptSignIn from '../../PromptSignIn.svelte';

	let idParamObj = $derived(page.params.id ? getIdStrAsIdObj(page.params.id) : null);
	// let numTags = $state(0);
	let tags = $state<
		{
			txt: string;
			num: number;
		}[]
	>([]);

	$effect(() => {
		idParamObj?.in_ms;
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
		e.detail.loaded();
		let endReached = res.tags.length < tagsPerLoad;
		if (endReached) {
			e.detail.complete();
			// numTags = tags.length;
		} else {
			// numTags = res.tagCount;
			e.detail.loaded();
		}
	};

	let savedTags = $derived(new Set(gs.accounts?.[0].savedTags));
</script>

{#if !idParamObj}
	<!--  -->
{:else if getPromptSigningIn(idParamObj)}
	<PromptSignIn />
{:else}
	<div class="p-2 w-full max-w-lg">
		<p class="text-xl font-bold">
			<!-- {numTags === 1
				? m.oneSpaceNameTag({ spaceName: spaceMsToSpaceName(idParamObj.in_ms) })
				: m.nSpaceNameTags({ n: numTags, spaceName: spaceMsToSpaceName(idParamObj.in_ms) })} -->
			{m.spaceNameTags({ spaceName: spaceMsToSpaceName(idParamObj.in_ms) })}
		</p>
		{#each tags || [] as tag, i (tag.txt)}
			<div class="flex text-lg">
				{i + 1}.
				{tag.num} -
				<a
					href={`/__${gs.currentSpaceMs}?q=${encodeURIComponent(`[${tag.txt}]`)}`}
					class="px-1 font-bold hover:underline hover:bg-bg3"
				>
					{tag.txt}
				</a>
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
		<InfiniteLoading identifier={idParamObj.in_ms} spinner="spiral" on:infinite={loadMoreTags}>
			<p slot="noMore" class="mb-2 text-lg text-fg2">{m.endOfList()}</p>
			<!-- <p slot="error" class="mb-2 text-lg text-fg2">{m.placeholderError()}</p> -->
		</InfiniteLoading>
	</div>
{/if}
