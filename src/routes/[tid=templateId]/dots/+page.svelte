<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { isStrInt } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { day, formatMs, hour, minute, week } from '$lib/time';
	import { trpc } from '$lib/trpc/client';
	import { msToAccountNameTxt } from '$lib/types/accounts';
	import { getWhoWhereObj } from '$lib/types/parts';
	import { getUrlInMs } from '$lib/types/parts/partIds';
	import {
		defaultSpaceProps,
		getPromptSigningIn,
		type Invite,
		type Membership,
		type Space,
	} from '$lib/types/spaces';
	import { membersPerLoad } from '$lib/types/spaces/_getSpaceMembers';
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

	let urlInMs = $derived(getUrlInMs());
	let validFor = $state(30 * minute);
	let maxUses = $state('1');
	let myInvites = $state<Invite[]>([]);

	let memberships = $state<Membership[]>([]);
	let accountMsToModPromotionMsByMsMap = $state<Record<number, { ms: number; byMs: number }>>({});
	let accountMsToOwnerPromotionMsByMsMap = $state<Record<number, { ms: number; byMs: number }>>({});

	$effect(() => {
		urlInMs; // TODO: is this how to reset members when switching spaces?
		memberships = [];
		accountMsToModPromotionMsByMsMap = {};
		accountMsToOwnerPromotionMsByMsMap = {};
	});

	let loadMoreAccounts = async (e: InfiniteEvent) => {
		if (!gs.accounts || urlInMs === undefined) return;
		let fromMs = memberships.slice(-1)[0]?.accept.ms;
		let res = await trpc().getSpaceMembers.query({
			...(await getWhoWhereObj()),
			fromMs,
		});
		console.log('res:', res);

		memberships = [...memberships, ...res.memberships];
		gs.msToAccountNameTxtMap = {
			...gs.msToAccountNameTxtMap,
			...res.msToAccountNameMap,
		};

		e.detail.loaded();
		let endReached = res.memberships.length < membersPerLoad;
		if (endReached) {
			e.detail.complete();
			// numAccounts = accounts.length;
		} else {
			// numAccounts = res.tagMs;
			e.detail.loaded();
		}
	};

	let space = $derived.by<Space>(() => {
		let inPersonalSpace = urlInMs === gs.accounts?.[0].ms;
		if (urlInMs === 0 || urlInMs === 1 || inPersonalSpace) {
			return {
				...defaultSpaceProps,
				ms: urlInMs!,
				description: {
					ms: 0,
					by_ms: 0,
					txt: inPersonalSpace
						? m.personalSpaceDescription()
						: urlInMs
							? m.globalSpaceDescription()
							: m.localSpaceDescription(),
				},
			};
		}
		return gs.pendingInvite?.in_ms === urlInMs //
			? gs.pendingInvite!.space
			: defaultSpaceProps;
	});

	// let savedAccounts = $derived(new Set(gs.accounts?.[0].savedAccounts));
</script>

{#if urlInMs === undefined}
	<!--  -->
{:else if getPromptSigningIn()}
	<PromptSignIn />
{:else}
	<div class="p-2 w-full max-w-lg">
		<SpaceOrAccountHeader
			{space}
			onChange={(changes) => {
				console.log('changes:', changes);
			}}
		/>
		{#if urlInMs && gs.accounts && urlInMs !== gs.accounts[0].ms}
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
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
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
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
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
			{#each myInvites as myInvite}
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
			<p class="text-xl font-black">{m.members()}</p>
			{#each memberships as membership}
				<div class="fx h-8">
					{#if !membership.promo?.owner}
						<IconShield />
					{:else if membership.promo?.owner}
						<IconCrown />
					{/if}
					<AccountIcon ms={membership.accept.by_ms} class="mx-1 h-6 w-6" />
					<p
						class={`font-medium text-lg ${gs.msToAccountNameTxtMap[membership.accept.by_ms] ? '' : 'italic'}`}
					>
						{msToAccountNameTxt(membership.accept.by_ms)}
					</p>
					<div class="flex-1"></div>
					{#if !false}
						<button
							class="h-full shrink-0 w-8 xy hover:bg-bg4"
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
					{/if}
				</div>
				<div class="text-sm text-fg2">
					<div class="fx justify-between">
						<div class="fx">
							<p class="mr-1">{m.acceptedInviteBy()}</p>
							<a class="fx hover:text-fg1" href={`/_${membership.invite.by_ms}_`}>
								<AccountIcon isSystem class="w-5 mr-0.5" ms={membership.invite.by_ms} />
								{msToAccountNameTxt(membership.invite.by_ms, true)}
							</a>
						</div>
						<p class="">{formatMs(membership.accept.ms, 'day')}</p>
					</div>
					{#if membership.promo}
						<div class="fx justify-between">
							<div class="fx">
								<p class="mr-1">{m.promotedBy()}</p>
								<a class="fx hover:text-fg1" href={`/_${membership.promo.by_ms}_`}>
									<AccountIcon isSystem class="w-5 mr-0.5" ms={membership.promo.by_ms} />
									{msToAccountNameTxt(membership.promo.by_ms, true)}
								</a>
							</div>
							<p class="">
								{formatMs(membership.promo.ms, 'day')}
							</p>
						</div>
					{/if}
					<div class="fx justify-between">
						<div class="fx">
							<p class="mr-1">
								{membership.canPostBin.num ? m.postingEnabledBy() : m.postingDisabledBy()}
							</p>
							<a class="fx hover:text-fg1" href={`/_${membership.canPostBin.by_ms}_`}>
								<AccountIcon isSystem class="w-5 mr-0.5" ms={membership.canPostBin.by_ms} />
								{msToAccountNameTxt(membership.canPostBin.by_ms, true)}
							</a>
						</div>
						<p class="">{formatMs(membership.accept.ms, 'day')}</p>
					</div>
					<div class="fx justify-between">
						<div class="fx">
							<p class="mr-1">
								{membership.canReactBin.num ? m.reactingEnabledBy() : m.reactingDisabledBy()}
							</p>
							<a class="fx hover:text-fg1" href={`/_${membership.canReactBin.by_ms}_`}>
								<AccountIcon isSystem class="w-5 mr-0.5" ms={membership.canReactBin.by_ms} />
								{msToAccountNameTxt(membership.canReactBin.by_ms, true)}
							</a>
						</div>
						<p class="">{formatMs(membership.accept.ms, 'day')}</p>
					</div>
				</div>
			{/each}
			<InfiniteLoading identifier={urlInMs} spinner="spiral" on:infinite={loadMoreAccounts}>
				<p slot="noMore" class="mb-2 text-lg text-fg2">{m.endOfList()}</p>
				<!-- <p slot="error" class="mb-2 text-lg text-fg2">{m.placeholderError()}</p> -->
			</InfiniteLoading>
		{/if}
	</div>
{/if}
