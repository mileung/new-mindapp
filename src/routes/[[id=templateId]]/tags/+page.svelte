<script lang="ts">
	import { page } from '$app/state';
	import { gs, spaceMsToSpaceName } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { idStrAsIdObj } from '$lib/types/parts/partIds';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import type { LayoutServerData } from '../../$types';
	import PromptSignIn from '../../PromptSignIn.svelte';

	let split = $derived(idStrAsIdObj(page.params.id || ''));
	let created = $derived(formatMs(split.ms!));

	let searchIpt: HTMLInputElement;
	let searchVal = $state('');
	let tags = $state<
		{
			txt: string;
			num: number;
		}[]
	>([]);

	let loadMoreTags = async (e: InfiniteEvent) => {
		// if (!gs.accounts || gs.currentSpaceMs === undefined) return;
		// let moreTags = (await getSpaceTags()).tags;
		// tags = [...tags, ...moreTags];
		// e.detail.loaded();

		let endReached = true; //rootPosts.length < postsPerLoad;
		endReached ? e.detail.complete() : e.detail.loaded();
	};

	let idObjParam = $derived(idStrAsIdObj(page.params.id || ''));
	let promptSignIn = $derived(
		(!(page.data as LayoutServerData).sessionIdExists || gs.accounts?.[0].ms === 0) &&
			idObjParam.in_ms !== 0 &&
			idObjParam.in_ms !== 1,
	);
</script>

{#if promptSignIn}
	<PromptSignIn />
{:else}
	<div class="xy min-h-screen p-5">
		<div class="w-full max-w-sm">
			<div class="text-xl font-bold">
				<p class="text-3xl font-black">
					{1 === 1
						? m.oneSpaceNameTag({ spaceName: spaceMsToSpaceName(0) })
						: m.nSpaceNameTags({ n: 1, spaceName: spaceMsToSpaceName(0) })}
				</p>
				<!-- <div class="mt-2 bg-bg2 min-w-0 flex h-9">
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
			</div> -->
				{#each tags || [] as tag, i}
					<div class="">
						<p class="">
							{tag.num} -
							<a
								href={`/l_l_${gs.currentSpaceMs}?q=${encodeURIComponent(`[${tag.txt}]`)}`}
								class="font-bold leading-5 hover:underline"
							>
								{tag.txt}
							</a>
						</p>
					</div>
				{/each}
				<InfiniteLoading identifier={'identifier'} spinner="spiral" on:infinite={loadMoreTags}>
					<p slot="noMore" class="mb-2 text-xl text-fg2">{m.endOfList()}</p>
					<p slot="error" class="mb-2 text-xl text-fg2">{m.anErrorOccurred()}</p>
				</InfiniteLoading>
			</div>
		</div>
	</div>
{/if}
