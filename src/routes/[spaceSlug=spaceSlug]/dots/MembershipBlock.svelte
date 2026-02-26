<script lang="ts">
	import { promptSum } from '$lib/dom';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { accountMsToNameTxt } from '$lib/types/accounts';
	import {
		defaultSpaceProps,
		permissionCodes,
		roleCodes,
		type Membership,
		type Space,
	} from '$lib/types/spaces';
	import {
		IconCrown,
		IconCrownFilled,
		IconCrownOff,
		IconDots,
		IconMoodMinus,
		IconMoodPlus,
		IconPencilMinus,
		IconPencilPlus,
		IconShield,
		IconShieldFilled,
		IconShieldOff,
		IconUserMinus,
		IconX,
	} from '@tabler/icons-svelte';
	import AccountIcon from '../../AccountIcon.svelte';

	// TODO: use a less rounded icon set with the same dx as @tabler/icons-svelte
	// Lucide, Lucide, Phosphor, Remix Icon, idk

	let p: { membership: Membership } = $props();

	let moreOptionsShown = $state(false);
	let spaceContext = $derived(gs.accounts?.[0].spaceMsToContextMap[gs.urlInMs || 0]);
	let callerIsOwner = $derived(spaceContext?.roleCode?.num === roleCodes.owner);
	let callerIsMod = $derived(spaceContext?.roleCode?.num === roleCodes.mod);

	$effect(() => {
		// gs.urlInMs; // TODO: is this how to reset members when switching spaces?
		// memberships = [];
		// accountMsToModPromotionMsByMsMap = {};
		// accountMsToOwnerPromotionMsByMsMap = {};
	});

	let callerMs = $derived(gs.accounts?.[0].ms);
	let membershipIsByCaller = $derived(p.membership.accept.by_ms === callerMs);
	let space = $derived.by<Space>(() => {
		let inPersonalSpace = gs.urlInMs === callerMs;
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

	let accepteeName = $derived(accountMsToNameTxt(p.membership.accept.by_ms));
</script>

<div class="fx h-8">
	<a class="fx hover:text-fg1 hover:bg-bg4" href={`/_${p.membership.accept.by_ms}_`}>
		{#if p.membership.role?.num === roleCodes.owner}
			<IconCrownFilled />
		{:else if p.membership.role?.num === roleCodes.mod}
			<IconShieldFilled />
		{/if}
		<AccountIcon ms={p.membership.accept.by_ms} class="mx-1 h-6 w-6" />
		<p
			class={`font-medium text-lg ${gs.accountMsToNameTxtMap[p.membership.accept.by_ms] ? '' : 'italic'}`}
		>
			{accepteeName}
		</p>
	</a>
	<div class="flex-1"></div>

	{#if moreOptionsShown}
		{#if membershipIsByCaller || callerIsOwner}
			<button
				class="h-8 w-8 xy hover:bg-bg4"
				onclick={() => {
					if (!membershipIsByCaller) {
						let ok = confirm(m.youAreAboutToRemoveAFromTheSpace({ a: accepteeName }));
						if (ok) {
							console.log('ok');
						}
					} else if (promptSum((a, b) => m.enterTheSumOfAAndBToLeaveTheSpace({ a, b }))) {
						console.log('correct');
					}
				}}
			>
				<IconUserMinus class="h-5" />
			</button>
		{/if}
		{#if callerIsMod || callerIsOwner}
			<button
				class="h-full shrink-0 w-8 xy hover:bg-bg4"
				onclick={() => {
					//
				}}
			>
				{#if p.membership.permission.num === permissionCodes.viewOnly || p.membership.permission.num === permissionCodes.postOnly}
					<IconMoodPlus class="h-5" />
				{:else}
					<IconMoodMinus class="h-5" />
				{/if}
			</button>
			<button
				class="h-full shrink-0 w-8 xy hover:bg-bg4"
				onclick={() => {
					//
				}}
			>
				{#if p.membership.permission.num === permissionCodes.viewOnly || p.membership.permission.num === permissionCodes.reactOnly}
					<IconPencilPlus class="h-5" />
				{:else}
					<IconPencilMinus class="h-5" />
				{/if}
			</button>
		{/if}
		{#if callerIsMod && membershipIsByCaller}
			<button
				class="h-full shrink-0 w-8 xy hover:bg-bg4"
				onclick={() => {
					if (promptSum((a, b) => m.enterTheSumOfAAndBToAssignYourselfFromModToMember({ a, b }))) {
						console.log('correct');
					}
				}}
			>
				<IconShieldOff class="h-5" />
			</button>
		{/if}
		{#if callerIsOwner}
			{#if membershipIsByCaller}
				<button
					class="h-full shrink-0 w-8 xy hover:bg-bg4"
					onclick={() => {
						if (promptSum((a, b) => m.enterTheSumOfAAndBToAssignYourselfFromOwnerToMod({ a, b }))) {
							console.log('correct');
						}
					}}
				>
					<IconCrownOff class="h-5" />
				</button>
			{:else}
				<button
					class="h-full shrink-0 w-8 xy hover:bg-bg4"
					onclick={() => {
						if (
							callerIsMod &&
							promptSum((a, b) =>
								m.enterTheSumOfAAndBToAssignCToMod({
									a,
									b,
									c: accepteeName,
								}),
							)
						) {
							console.log('correct');
						}
					}}
				>
					<IconShield class="h-5" />
				</button>
				<button
					class="h-full shrink-0 w-8 xy hover:bg-bg4"
					onclick={() => {
						if (
							promptSum((a, b) =>
								m.enterTheSumOfAAndBToAssignCToCoOwner({
									a,
									b,
									c: accepteeName,
								}),
							)
						) {
							console.log('correct');
						}
					}}
				>
					<IconCrown class="h-5" />
				</button>
			{/if}
		{/if}
	{/if}
	{#if callerIsOwner || callerIsMod}
		<button
			class="h-8 w-8 xy hover:bg-bg4 hover:text-fg3"
			onclick={() => (moreOptionsShown = !moreOptionsShown)}
		>
			{#if moreOptionsShown}
				<IconX class="h-5" />
			{:else}
				<IconDots class="h-5" />
			{/if}
		</button>
	{/if}
</div>
<div class="text-sm text-fg2">
	<div class="fx justify-between">
		<div class="fx">
			<p class="mr-1">{m.acceptedInviteBy()}</p>
			<a class="fx hover:text-fg1 hover:bg-bg4" href={`/_${p.membership.invite.by_ms}_`}>
				<AccountIcon isSystem class="w-5 mr-0.5" ms={p.membership.invite.by_ms} />
				{accountMsToNameTxt(p.membership.invite.by_ms, true)}
			</a>
		</div>
		<p class="">{formatMs(p.membership.accept.ms, 'day')}</p>
	</div>
	{#if p.membership.role}
		<div class="fx justify-between">
			<div class="fx">
				<p class="mr-1">{roleDict[p.membership.role.num]}</p>
				<a class="fx hover:text-fg1 hover:bg-bg4" href={`/_${p.membership.role.by_ms}_`}>
					<AccountIcon isSystem class="w-5 mr-0.5" ms={p.membership.role.by_ms} />
					{accountMsToNameTxt(p.membership.role.by_ms, true)}
				</a>
			</div>
			<p class="">
				{formatMs(p.membership.role.ms, 'day')}
			</p>
		</div>
	{/if}
	<div class="fx justify-between">
		<div class="fx">
			<p class="mr-1">{permissionDict[p.membership.permission.num]}</p>
			<a class="fx hover:text-fg1 hover:bg-bg4" href={`/_${p.membership.permission.by_ms}_`}>
				<AccountIcon isSystem class="w-5 mr-0.5" ms={p.membership.permission.by_ms} />
				{accountMsToNameTxt(p.membership.permission.by_ms, true)}
			</a>
		</div>
		<p class="">{formatMs(p.membership.permission.ms, 'day')}</p>
	</div>
</div>
