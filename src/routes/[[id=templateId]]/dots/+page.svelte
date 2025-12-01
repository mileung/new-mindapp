<script lang="ts">
	import { page } from '$app/state';
	import { gs, spaceMsToSpaceName } from '$lib/global-state.svelte';
	import { identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import type { Account } from '$lib/types/accounts';
	import { getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import { getPromptSigningIn } from '$lib/types/spaces';
	import { accountsPerLoad, getSpaceAccounts } from '$lib/types/spaces/getSpaceAccounts';
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
	import PromptSignIn from '../../PromptSignIn.svelte';

	let idParamObj = $derived(page.params.id ? getIdStrAsIdObj(page.params.id) : null);
	let numAccounts = $state(0);
	let created = $derived(idParamObj?.in_ms || 0);
	let searchIpt = $state<HTMLInputElement>();
	let searchVal = $state('');
	let accountMss = $state<number[]>([]);
	let accounts = $state<Account[]>([]);

	$effect(() => {
		idParamObj?.in_ms;
		accounts = [];
	});

	let loadMoreAccounts = async (e: InfiniteEvent) => {
		if (!gs.accounts || gs.currentSpaceMs === undefined) return;
		let fromAccountMs = accounts.slice(-1)[0]?.ms || Number.MAX_SAFE_INTEGER;
		let res = await getSpaceAccounts(fromAccountMs);
		accounts = [...accounts, ...res.accounts];
		// let accounts: Awaited<ReturnType<typeof getPostFeed>>;
		accountMss = [
			//
			...Array(19),
		].map(() => +('' + Math.random()).slice(2));

		e.detail.loaded();
		let endReached = res.accounts.length < accountsPerLoad;
		if (endReached) {
			e.detail.complete();
			// numAccounts = accounts.length;
		} else {
			// numAccounts = res.tagMs;
			e.detail.loaded();
		}
	};

	// let savedAccounts = $derived(new Set(gs.accounts?.[0].savedAccounts));
</script>

{#if !idParamObj}
	<!--  -->
{:else if getPromptSigningIn(idParamObj)}
	<PromptSignIn />
{:else}
	<div class="p-2 w-full max-w-lg">
		<p class="text-xl font-bold">
			<!-- {numAccounts === 1
				? m.oneSpaceNameTag({ spaceName: spaceMsToSpaceName(idParamObj.in_ms) })
				: m.nSpaceNameAccounts({ n: numAccounts, spaceName: spaceMsToSpaceName(idParamObj.in_ms) })} -->
			<!-- {m.spaceNameAccounts({ spaceName: spaceMsToSpaceName(idParamObj.in_ms) })} -->
		</p>
		<div class="flex justify-between">
			<p class="text-xl font-black">
				{spaceMsToSpaceName(idParamObj.in_ms)}
			</p>
			<a
				href={`/${page.params.id}/invite`}
				class="xy text-black h-8 px-2 gap-1 bg-hl1 hover:bg-hl2"
			>
				<IconUsersPlus />
				{m.invite()}
			</a>
		</div>
		<p class="mt-2">{m.sinceD({ d: formatMs(created) })}</p>
		<p class="">{1 === 1 ? m.onePost() : m.nPosts({ n: 1 })}</p>
		<p>{1 === 1 ? m.oneAccount() : m.nAccounts({ n: 1 })}</p>

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
		<InfiniteLoading identifier={idParamObj.in_ms} spinner="spiral" on:infinite={loadMoreAccounts}>
			<p slot="noMore" class="mb-2 text-lg text-fg2">{m.endOfList()}</p>
			<!-- <p slot="error" class="mb-2 text-lg text-fg2">{m.placeholderError()}</p> -->
		</InfiniteLoading>
	</div>
{/if}
