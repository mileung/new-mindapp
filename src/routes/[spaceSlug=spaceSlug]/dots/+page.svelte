<script lang="ts">
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { isStrInt } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { day, formatMs, hour, minute, week } from '$lib/time';
	import { trpc } from '$lib/trpc/client';
	import { getWhoWhereObj } from '$lib/types/parts';
	import {
		defaultSpaceProps,
		getPromptSigningIn,
		permissionCodes,
		roleCodes,
		type Invite,
		type Membership,
		type Space,
	} from '$lib/types/spaces';
	import { membersPerLoad } from '$lib/types/spaces/_getSpaceDots';
	import {
		IconCheck,
		IconCopy,
		IconLinkMinus,
		IconLinkPlus,
		IconShare2,
	} from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import PromptSignIn from '../../PromptSignIn.svelte';
	import SpaceOrAccountHeader from '../../SpaceOrAccountHeader.svelte';
	import MembershipBlock from './MembershipBlock.svelte';

	// TODO: use a less rounded icon set with the same dx as @tabler/icons-svelte
	// Lucide, Lucide, Phosphor, Remix Icon, idk

	let identifier = $derived(page.url.href);
	let copiedInviteSlugTimeout: NodeJS.Timeout;
	let validFor = $state(30 * minute);
	let maxUses = $state('1');
	let copiedInviteSlug = $state('');
	let myInvites = $state<Invite[]>([]);
	let spaceContext = $derived(gs.accounts?.[0].spaceMsToContextMap[gs.urlInMs || 0]);
	let canView = $derived(spaceContext?.isPublic || spaceContext?.roleCode !== undefined);

	let memberships = $state<Membership[]>([]);
	let accountMsToModPromotionMsByMsMap = $state<Record<number, { ms: number; byMs: number }>>({});
	let accountMsToOwnerPromotionMsByMsMap = $state<Record<number, { ms: number; byMs: number }>>({});

	$effect(() => {
		// gs.urlInMs; // TODO: is this how to reset members when switching spaces?
		// memberships = [];
		// accountMsToModPromotionMsByMsMap = {};
		// accountMsToOwnerPromotionMsByMsMap = {};
	});

	let loadMoreDots = async (e: InfiniteEvent) => {
		console.log('loadMoreDots');
		if (!canView || !gs.accounts || gs.urlInMs === undefined) return;
		let msAfter = memberships.slice(-1)[0]?.accept.ms;
		let res = await trpc().getSpaceDots.query({
			...(await getWhoWhereObj()),
			msAfter,
		});
		console.log('res:', res);

		memberships = [...memberships, ...res.memberships];
		gs.accountMsToNameTxtMap = {
			...gs.accountMsToNameTxtMap,
			...res.msToAccountNameTxtMap,
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
		let inPersonalSpace = gs.urlInMs === gs.accounts?.[0].ms;
		if (gs.urlInMs === 0 || gs.urlInMs === 1 || inPersonalSpace) {
			return {
				...defaultSpaceProps,
				ms: gs.urlInMs!,
			} satisfies Space;
		}
		return defaultSpaceProps;
		// return gs.pendingInvite?.in_ms === gs.urlInMs //
		// 	? gs.pendingInvite!.space
		// 	: defaultSpaceProps;
	});

	let roleDict = $derived<Record<number, string>>({
		[roleCodes.member]: m.assignedMemberBy(),
		[roleCodes.mod]: m.assignedModBy(),
		[roleCodes.owner]: m.assignedOwnerBy(),
	});

	let permissionDict = $derived<Record<number, string>>({
		[permissionCodes.viewOnly]: m.viewOnlySetBy(),
		[permissionCodes.reactOnly]: m.canReactSetBy(),
		[permissionCodes.postOnly]: m.canPostSetBy(),
		[permissionCodes.reactAndPost]: m.canReactPostSetBy(),
	});

	// let savedAccounts = $derived(new Set(gs.accounts?.[0].savedAccounts));
</script>

{#if gs.urlInMs === undefined}
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
		{#if gs.urlInMs && gs.accounts && gs.urlInMs !== gs.accounts[0].ms}
			<div class="h-0.5 mt-2 w-full bg-bg8"></div>
			<p class="text-xl font-black">{m.yourInviteLinks()}</p>
			<form
				onsubmit={async (e) => {
					e.preventDefault();
					let inviteProps = await trpc().createInviteLink.mutate({
						...(await getWhoWhereObj()),
						validFor,
						maxUses: isStrInt(maxUses) ? +maxUses : 0,
					});
					myInvites.push({
						by_ms: gs.accounts![0].ms,
						in_ms: gs.urlInMs!,
						...inviteProps,
					});
				}}
			>
				<div class="flex">
					<div class="flex-1">
						<p class="text-sm font-bold">{m.validFor()}</p>
						<select
							name={m.validFor()}
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg5 text-fg1"
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
								type="button"
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
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg5 text-fg1"
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
					{m.createLink()}
				</button>
			</form>
			{#each myInvites as myInvite}
				<div class="mt-2">
					<div class="fx justify-between"></div>
					<div class="fx justify-between">
						<button
							class="w-full fx text-fg1 hover:text-fg3 hover:bg-bg4"
							onclick={() => {
								navigator.clipboard.writeText(`${page.url.origin}/invite/${myInvite.slug}`);
								copiedInviteSlug = myInvite.slug;
								clearTimeout(copiedInviteSlugTimeout);
								copiedInviteSlugTimeout = setTimeout(() => {
									if (copiedInviteSlug === myInvite.slug) copiedInviteSlug = '';
								}, 888);
							}}
						>
							<span class="truncate">{page.url.protocol}//...{myInvite.slug.slice(-8)}</span>
							{#if copiedInviteSlug === myInvite.slug}
								<IconCheck class="h-4" />
							{:else}
								<IconCopy class="h-4" />
							{/if}
						</button>
						<button
							class="fx text-fg2 hover:text-fg1 hover:bg-bg4"
							onclick={() =>
								navigator.share({
									url: `${page.url.origin}/invite/${myInvite.slug}`,
								})}
						>
							Share
							<IconShare2 class="h-4 -mr-1.5" />
						</button>
					</div>
					<div class="fx justify-between text-fg2">
						<p>Expires {formatMs(myInvite.expiryMs, 'min')}</p>
						<p>{m.nmUses({ n: 2, m: 5 })}</p>
					</div>
					<button
						class="fx text-fg2 hover:text-fg1 hover:bg-bg4"
						onclick={() => {
							let ok = confirm('Are you sure you want to revoke this invite link?');
							ok;
						}}
					>
						{m.revoke()}
						<IconLinkMinus class="h-4 " />
					</button>
				</div>
			{/each}
			<div class="h-0.5 mt-2 w-full bg-bg8"></div>
			<p class="text-xl font-black">{m.members()}</p>
			{#each memberships as membership}
				<MembershipBlock {membership} />
			{/each}
			<InfiniteLoading {identifier} spinner="spiral" on:infinite={loadMoreDots}>
				<p slot="noMore" class="mb-2 text-lg text-fg2">{m.theEnd()}</p>
				<!-- <p slot="error" class="mb-2 text-lg text-fg2">{m.placeholderError()}</p> -->
			</InfiniteLoading>
		{/if}
	</div>
{/if}
