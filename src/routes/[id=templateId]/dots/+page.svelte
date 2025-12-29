<script lang="ts">
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { isStrInt } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { day, formatMs, hour, minute, week } from '$lib/time';
	import { trpc } from '$lib/trpc/client';
	import type { MyAccount } from '$lib/types/accounts';
	import { getWhoWhereObj } from '$lib/types/parts';
	import { getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import { getPromptSigningIn } from '$lib/types/spaces';
	import { accountsPerLoad, getSpaceAccounts } from '$lib/types/spaces/getSpaceAccounts';
	import {
		IconCopy,
		IconCrown,
		IconLinkMinus,
		IconLinkPlus,
		IconMoodOff,
		IconMoodSmile,
		IconPencil,
		IconPencilOff,
		IconShield,
		IconShieldOff,
		IconUserMinus,
	} from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import AccountIcon from '../../AccountIcon.svelte';
	import PromptSignIn from '../../PromptSignIn.svelte';
	import SpaceOrAccountHeader from '../../SpaceOrAccountHeader.svelte';

	// TODO: use a less rounded icon set with the same dx as @tabler/icons-svelte
	// Lucide, Lucide, Phosphor, Remix Icon, idk

	let idParamObj = $derived(getIdStrAsIdObj(page.params.id!));
	let validFor = $state(30 * minute);
	let maxUses = $state('1');
	let accountMss = $state<number[]>([]);
	let accounts = $state<MyAccount[]>([]);
	let copiedCodes = $state<Record<string, undefined | true>>({});

	$effect(() => {
		idParamObj?.in_ms;
		accounts = [];
	});

	let loadMoreAccounts = async (e: InfiniteEvent) => {
		if (!gs.accounts || gs.currentSpaceMs === undefined) return;
		let fromMs = accounts.slice(-1)[0]?.ms || Number.MAX_SAFE_INTEGER;
		let res = await getSpaceAccounts(fromMs);
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
{:else if getPromptSigningIn()}
	<PromptSignIn />
{:else}
	<div class="p-2 w-full max-w-lg">
		<SpaceOrAccountHeader ms={idParamObj.in_ms} />
		<div class="h-0.5 mt-2 w-full bg-bg8"></div>
		<p class="text-xl font-black">{m.yourInviteLinks()}</p>
		<form
			onsubmit={async (e) => {
				e.preventDefault();
				let { inviteSlug } = await trpc().createInvite.mutate({
					...(await getWhoWhereObj()),
					validFor,
					maxUses: isStrInt(maxUses) ? +maxUses : 0,
				});
				console.log('inviteSlug:', inviteSlug);
			}}
		>
			<div class="flex">
				<div class="flex-1">
					<p class="text-sm font-bold">{m.validFor()}</p>
					<select
						name={m.validFor()}
						class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-2 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
						bind:value={validFor}
					>
						<option value={5 * minute}>{m.fiveMinutes()}</option>
						<option value={30 * minute}>{m.thirtyMinutes()}</option>
						<option value={hour}>{m.oneHour()}</option>
						<option value={6 * hour}>{m.sixHours()}</option>
						<option value={12 * hour}>{m.twelveHours()}</option>
						<option value={day}>{m.oneDay()}</option>
						<option value={week}>{m.oneWeek()}</option>
						<option value={0}>{m.forever()}</option>
					</select>
				</div>
				<div class="flex-1">
					<div class="fx justify-between">
						<p class="text-sm font-bold">{m.maxUses()}</p>
						<button
							class="text-sm text-fg2 hover:text-fg1"
							onclick={() => (maxUses = m.unlimited())}
						>
							{m.unlimited()}
						</button>
					</div>
					<input
						required
						inputmode="numeric"
						autocomplete="off"
						name={m.maxUses()}
						class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-2 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
						bind:value={maxUses}
						minlength={1}
						oninput={(e) => {
							let { value } = e.currentTarget;
							if (value === '0' || value.length > 8 || value.startsWith(m.unlimited())) {
								maxUses = m.unlimited();
							} else if (/[^0-9]/.test(value)) {
								maxUses = '1';
							} else {
								let v = value.replace(/[^0-9]/g, '');
								v = v.replace(/^0+/, '');
								maxUses = v;
							}
						}}
					/>
				</div>
			</div>
			<button
				type="submit"
				class="mt-2 h-8 xy px-2 py-1 bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-2 border-hl1 hover:border-hl2"
			>
				<IconLinkPlus class="w-5 mr-1" />
				{m.copyNewLink()}
			</button>
		</form>
		{#each accountMss.slice(0, 5) || [] as ms}
			<div class="mt-2">
				<div class="fx justify-between font-bold">
					<p>5m-{formatMs(Date.now(), 'min')}</p>
					<p>{m.nmUses({ n: 2, m: 5 })}</p>
				</div>
				<div class="fx justify-between text-sm">
					<button
						class="fx text-fg2 hover:text-fg1"
						onclick={() => {
							let ok = confirm('Are you sure you want to revoke this invite link?');
						}}
					>
						<p>Revoke</p>
						<IconLinkMinus class="h-4 " />
					</button>
					<button
						class="fx text-fg2 hover:text-fg1"
						onclick={() => {
							//
						}}
					>
						<p>...92RA5a52th</p>
						<!-- {copiedCodes} -->
						<IconCopy class="h-4 -mr-1.5" />
					</button>
				</div>
			</div>
		{/each}
		<div class="h-0.5 mt-2 w-full bg-bg8"></div>
		<p class="text-xl font-black">Members</p>
		{#each accountMss || [] as ms}
			<div class="fx h-8">
				<AccountIcon {ms} class="h-6 w-6" />
				<p class="mx-2 font-medium text-lg italic"></p>
				<span class="truncate text-sm text-fg2 font-normal">{ms}</span>
				<button
					class="ml-auto h-full shrink-0 w-8 xy hover:bg-bg4"
					onclick={() => {
						//
					}}
				>
					<IconUserMinus class="h-5" />
				</button>
				<button
					class="h-full shrink-0 w-8 xy hover:bg-bg4"
					onclick={() => {
						//
					}}
				>
					{#if true}
						<IconMoodSmile class="h-5" />
					{:else}
						<IconMoodOff class="h-5" />
					{/if}
				</button>
				<button
					class="h-full shrink-0 w-8 xy hover:bg-bg4"
					onclick={() => {
						//
					}}
				>
					{#if true}
						<IconPencil class="h-5" />
					{:else}
						<IconPencilOff class="h-5" />
					{/if}
				</button>
				<button
					class="h-full shrink-0 w-8 xy hover:bg-bg4"
					onclick={() => {
						//
					}}
				>
					{#if true}
						<IconShield class="h-5" />
					{:else}
						<IconShieldOff class="h-5" />
					{/if}
				</button>
				<button
					class="h-full shrink-0 w-8 xy hover:bg-bg4"
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
