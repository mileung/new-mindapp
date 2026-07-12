<script lang="ts">
	import {
		getCallerIsOwner,
		getPromptEnableLocalSpace,
		getPromptSigningIn,
		getSpaceContext,
		gs,
		msToSpaceNameTxt,
	} from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { getUrlInMs } from '$lib/types/parts/partIds';
	import { getSpaceTags, tagsPerLoad } from '$lib/types/spaces/getSpaceTags';
	import {
		IconDeselect,
		IconSelectAll,
		IconSquare,
		IconSquareCheckFilled,
	} from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import PromptEnableLocalSpace from '../../PromptEnableLocalSpace.svelte';
	import PromptSignIn from '../../PromptSignIn.svelte';
	import SpaceIcon from '../../SpaceIcon.svelte';

	let urlInMs = $derived(getUrlInMs()!);
	let space = $derived(gs.msToSpaceMap[urlInMs]);
	let spaceContext = $derived(getSpaceContext(urlInMs));
	let callerIsOwner = $derived(getCallerIsOwner());
	let viewable = $derived(callerIsOwner || space?.isPublic.num || spaceContext?.permissionCode);
	let tagsData = $derived(gs.spaceMsToTagsMap[urlInMs]);
	let tags = $derived(tagsData?.tags || []);

	let loadMoreTags = async (e: InfiniteEvent) => {
		if (!gs.accounts || urlInMs === undefined) return;
		if (tagsData?.endReached) {
			tags.length && e.detail.loaded();
			return e.detail.complete();
		}
		let lastCount = tags.at(-1)?.num || Number.MAX_SAFE_INTEGER;
		let lastTag = tags.at(-1)?.txt;
		let res = await getSpaceTags(lastCount, lastTag);
		// console.log('res:', res);
		res.tags.length && e.detail.loaded();
		let endReached = res.tags.length < tagsPerLoad;
		endReached && e.detail.complete();
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
	let pageSelected = $derived(!!tags.length && tags.every((t) => savedTagsSet.has(t.txt)));
	let endingPanelClass = 'h-[calc(100vh-36px)] xs:h-screen p-2 pt-8 text-lg text-fg2';
</script>

{#if urlInMs === undefined || !gs.accounts}
	<!--  -->
{:else if getPromptSigningIn()}
	<PromptSignIn />
{:else if getPromptEnableLocalSpace()}
	<PromptEnableLocalSpace />
{:else if !viewable}
	<p class="m-2 text-lg text-fg2 text-center">{m.spaceNotFound()}</p>
{:else}
	<div class="px-2 pb-9 xs:pb-0 w-full max-w-lg">
		<div class="pt-8">
			<div
				class="h-8 w-full max-w-lg fixed top-0 left-0 xs:left-[var(--w-sidebar)] bg-bg1 flex justify-between"
			>
				<p class="pl-2 text-xl self-center font-bold text-nowrap overflow-scroll">
					{m.spaceNameTags({ spaceName: msToSpaceNameTxt(urlInMs) })}
				</p>
				{#if tags.length}
					<button
						class="xy pl-0.5 pr-1 text-nowrap hover:bg-bg4 text-fg2 hover:text-fg1"
						onclick={() => {
							if (pageSelected && !confirm(m.unsavedTagsWillNoLongerBeAutocompleted())) return;
							updateSavedTags(
								pageSelected ? [] : tags.map((t) => t.txt),
								pageSelected ? tags.map((t) => t.txt) : [],
							);
						}}
					>
						{#if pageSelected}
							<IconDeselect class="w-5 mr-1" />
						{:else}
							<IconSelectAll class="w-5 mr-1" />
						{/if}
						{pageSelected ? m.unsaveLoadedTags() : m.saveLoadedTags()}
					</button>
				{/if}
			</div>
			{#each tags || [] as tag, i (tag.txt)}
				<div class="flex text-lg">
					<a
						class="fx px-1 group hover:bg-bg3 text-nowrap overflow-scroll"
						href={`/${urlInMs}__?q=${`[${tag.txt}]${!urlInMs && tag.in_ms ? ` in_ms:${tag.in_ms}` : ''}`}`}
					>
						{tag.num} -
						<span class="ml-1.5 font-bold group-hover:underline">
							{tag.txt}
						</span>
						{#if !urlInMs && tag.in_ms}
							<SpaceIcon ms={tag.in_ms} class="shrink-0 h-5 w-5 ml-2 mr-1" />
							{msToSpaceNameTxt(tag.in_ms)}
						{/if}
					</a>
					<button
						class="group flex-1 hover:bg-bg3 pr-1"
						onclick={() =>
							updateSavedTags(
								savedTagsSet.has(tag.txt) ? [] : [tag.txt],
								savedTagsSet.has(tag.txt) ? [tag.txt] : [],
							)}
					>
						<IconSquare class={`ml-auto w-5 ${savedTagsSet.has(tag.txt) ? 'hidden' : 'block'}`} />
						<IconSquareCheckFilled
							class={`ml-auto w-5 ${savedTagsSet.has(tag.txt) ? 'block' : 'hidden'}`}
						/>
					</button>
				</div>
			{/each}
		</div>
		<InfiniteLoading identifier={urlInMs} spinner="spiral" on:infinite={loadMoreTags}>
			<div slot="error" class={endingPanelClass}>
				{m.placeholderError()}
			</div>
			<div slot="noResults" class={endingPanelClass}>
				{m.noTagsFound()}
			</div>
			<div slot="noMore" class={endingPanelClass}>
				{m.theEnd()}
			</div>
		</InfiniteLoading>
	</div>
{/if}
