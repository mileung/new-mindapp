<script lang="ts">
	import { page } from '$app/state';
	import { gs, spaceMsToSpaceName } from '$lib/global-state.svelte';
	import { identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { idStrAsIdObj } from '$lib/types/parts/partIds';
	import {
		IconCrown,
		IconSearch,
		IconStar,
		IconStarOff,
		IconUserMinus,
		IconUsersPlus,
	} from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import type { LayoutServerData } from '../../$types';
	import AccountIcon from '../../AccountIcon.svelte';
	import PromptSignIn from '../../PromptSignIn.svelte';

	let split = $derived(idStrAsIdObj(page.params.id || ''));
	let created = $derived(formatMs(split.ms!));

	let searchIpt = $state<HTMLInputElement>();
	let searchVal = $state('');
	let accountMss = $state<number[]>([]);

	let loadMoreAccounts = async (e: InfiniteEvent) => {
		// await new Promise((res) => setTimeout(res, 1000));
		// console.log(
		// 	'loadMoreAccounts:',
		// 	identifier,
		// 	// $state.snapshot(gs.feeds[identifier]),
		// 	// $state.snapshot(gs.posts),
		// );

		// if (!gs.accounts || !identifier || !p.idParam || personalSpaceRequiresLogin) return;

		// let fromMs = gs.feeds[identifier]?.slice(-1)[0];
		// if (fromMs === null) return e.detail.complete();
		// fromMs = typeof fromMs === 'number' ? fromMs : oldestFirst ? 0 : Number.MAX_SAFE_INTEGER;

		// let accounts: Awaited<ReturnType<typeof getPostFeed>>;
		accountMss = [
			//
			...Array(19),
		].map(() => +('' + Math.random()).slice(2));
		let newFromMs = 0; //lastRoot?.ms;
		let endReached = true; //rootPosts.length < postsPerLoad;
		e.detail.loaded();
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
					{spaceMsToSpaceName(0)}
				</p>
				{#if 0 > 1}
					<p class="mt-2">{m.createdD({ d: created })}</p>
				{/if}
				<p class="mt-2">{1 === 1 ? m.onePost() : m.nPosts({ n: 1 })}</p>
				<div class="mt-2 flex justify-between">
					<p>{1 === 1 ? m.oneAccount() : m.nAccounts({ n: 1 })}</p>
					<a
						href={`/${page.params.id}/invite`}
						class="xy text-black p-1 px-2 gap-1 bg-hl1 hover:bg-hl2"
					>
						<IconUsersPlus />
						{m.invite()}
					</a>
				</div>
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
				{#each accountMss || [] as ms}
					<div class="fx h-8">
						<AccountIcon {ms} class="h-6 w-6" />
						<p class="mx-2 font-medium text-lg italic">
							{identikana(ms)}
						</p>
						<span class="truncate text-sm text-fg2 font-normal">{ms}</span>
						<button
							class="ml-auto h-full min-w-8 xy hover:bg-bg4"
							onclick={() => {
								//
							}}
						>
							<IconUserMinus class="h-5" />
						</button>
						<button
							class="h-full min-w-8 xy hover:bg-bg4"
							onclick={() => {
								//
							}}
						>
							{#if true}
								<IconStar class="h-5" />
							{:else}
								<IconStarOff class="h-5" />
							{/if}
						</button>
						<button
							class="h-full min-w-8 xy hover:bg-bg4"
							onclick={() => {
								//
							}}
						>
							<IconCrown class="h-5" />
						</button>
					</div>
				{/each}
				<InfiniteLoading identifier={'identifier'} spinner="spiral" on:infinite={loadMoreAccounts}>
					<p slot="noMore" class="mb-2 text-xl text-fg2">{m.endOfList()}</p>
					<p slot="error" class="mb-2 text-xl text-fg2">{m.anErrorOccurred()}</p>
				</InfiniteLoading>
			</div>
		</div>
	</div>
{/if}
