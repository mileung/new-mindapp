<script lang="ts">
	import { goto } from '$app/navigation';
	import { promptSum } from '$lib/dom';
	import {
		getUrlInMsContext,
		getWhoWhereObj,
		gs,
		msToAccountNameTxt,
	} from '$lib/global-state.svelte';
	import { alertError } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { trpc } from '$lib/trpc/client';
	import { updateLocalCache } from '$lib/types/local-cache';
	import {
		permissionCodes,
		roleCodes,
		type Membership,
		type PermissionCode,
		type RoleCode,
	} from '$lib/types/spaces';
	import {
		IconCrown,
		IconCrownFilled,
		IconCrownOff,
		IconDots,
		IconFlag3,
		IconMoodOff,
		IconMoodPlus,
		IconPencilOff,
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
	let spaceContext = $derived(getUrlInMsContext());
	let callerIsOwner = $derived(spaceContext?.roleCode?.num === roleCodes.owner);
	let callerIsMod = $derived(spaceContext?.roleCode?.num === roleCodes.mod);
	let spaceMs = $derived(p.membership.invite.in_ms!);
	let space = $derived(gs.msToSpaceMap[spaceMs]!);

	let callerMs = $derived(gs.accounts?.[0].ms);
	let accepteeMs = $derived(p.membership.accept.by_ms!);
	let membershipIsByCaller = $derived(accepteeMs === callerMs);

	let accepteeName = $derived(msToAccountNameTxt(accepteeMs));
	let membershipRoleCode = $derived(p.membership.roleCode);
	let memberIsOwner = $derived(membershipRoleCode?.num === roleCodes.owner);
	let memberIsMod = $derived(membershipRoleCode?.num === roleCodes.mod);
	let memberIsModOrOwner = $derived(memberIsMod || memberIsOwner);
	let authorityOverMember = $derived(membershipRoleCode.num < (spaceContext?.roleCode?.num || 0));

	let membershipFlair = $derived(p.membership.flair);
	let roleText = $derived(
		{
			[roleCodes.member]: m.assignedMemberBy(),
			[roleCodes.mod]: m.assignedModBy(),
			[roleCodes.owner]: m.assignedOwnerBy(),
		}[membershipRoleCode.num],
	);

	let permissionCode = $derived(p.membership.permissionCode);
	let permissionText = $derived(
		{
			[permissionCodes.viewOnly]: m.viewOnlySetBy(),
			[permissionCodes.reactOnly]: m.canReactSetBy(),
			[permissionCodes.postOnly]: m.canPostSetBy(),
			[permissionCodes.reactAndPost]: m.canReactPostSetBy(),
		}[permissionCode.num],
	);

	let mergeMembershipUpdate = (
		update: Partial<Pick<Membership, 'roleCode' | 'permissionCode' | 'flair'>>,
	) => {
		gs.spaceMsToAccountMsToMembershipMap = {
			...gs.spaceMsToAccountMsToMembershipMap,
			[spaceMs]: {
				...gs.spaceMsToAccountMsToMembershipMap[spaceMs],
				[accepteeMs]: {
					...gs.spaceMsToAccountMsToMembershipMap[spaceMs]![accepteeMs],
					...update,
				},
			},
		};
	};

	let canReactAndPost = $derived(permissionCode.num === permissionCodes.reactAndPost);
	let canReact = $derived(canReactAndPost || permissionCode.num === permissionCodes.reactOnly);
	let canPost = $derived(canReactAndPost || permissionCode.num === permissionCodes.postOnly);
	let setPermission = async (toggleCanReact: boolean, toggleCanPost: boolean) => {
		let nextCanReact = toggleCanReact ? !canReact : canReact;
		let nextCanPost = toggleCanPost ? !canPost : canPost;
		let ok = promptSum((a, b) => {
			if (toggleCanReact) {
				return nextCanReact
					? m.enterTheSumOfAAndBToEnableReactingForC({ a, b, c: accepteeName })
					: m.enterTheSumOfAAndBToDisableReactingForC({ a, b, c: accepteeName });
			}
			return nextCanPost
				? m.enterTheSumOfAAndBToEnablePostingForC({ a, b, c: accepteeName })
				: m.enterTheSumOfAAndBToDisablePostingForC({ a, b, c: accepteeName });
		});
		if (ok) {
			let newPermissionCodeNum: PermissionCode;
			if (nextCanReact && nextCanPost) newPermissionCodeNum = permissionCodes.reactAndPost;
			else if (nextCanReact) newPermissionCodeNum = permissionCodes.reactOnly;
			else if (nextCanPost) newPermissionCodeNum = permissionCodes.postOnly;
			else newPermissionCodeNum = permissionCodes.viewOnly;
			try {
				let { ms } = await trpc().setSpaceMemberPermission.mutate({
					...(await getWhoWhereObj()),
					accountMs: accepteeMs,
					newPermissionCodeNum,
				});
				mergeMembershipUpdate({
					permissionCode: {
						ms,
						by_ms: callerMs,
						num: newPermissionCodeNum,
					},
				});
			} catch (error) {
				alertError(error);
			}
		}
	};

	let setRole = async (newRoleCodeNum: RoleCode) => {
		let toMember = newRoleCodeNum === roleCodes.member;
		let toMod = newRoleCodeNum === roleCodes.mod;
		let ok = false;
		if (membershipIsByCaller) {
			let fn = m.enterTheSumOfAAndBToAssignYourselfFromModToMember;
			if (toMember) 0;
			else if (toMod) {
				if (
					!Object.values(gs.spaceMsToAccountMsToMembershipMap[spaceMs]!).some(
						(m) =>
							m && //
							m.roleCode &&
							m.accept &&
							m.roleCode.num === roleCodes.owner &&
							m.accept.by_ms !== callerMs,
					)
				)
					return alert(m.assignAnotherOwnerToAssignYourselfToMod());
				fn = m.enterTheSumOfAAndBToAssignYourselfFromOwnerToMod;
			}
			ok = promptSum((a, b) => fn({ a, b }));
		} else {
			let fn = m.enterTheSumOfAAndBToAssignCToMember;
			if (toMember) 0;
			else if (toMod) fn = m.enterTheSumOfAAndBToAssignCToMod;
			else if (newRoleCodeNum === roleCodes.owner) fn = m.enterTheSumOfAAndBToAssignCToCoOwner;
			ok = promptSum((a, b) => fn({ a, b, c: accepteeName }));
		}
		if (ok) {
			try {
				let { ms } = await trpc().setSpaceMemberRole.mutate({
					...(await getWhoWhereObj()),
					accountMs: accepteeMs,
					newRoleCodeNum,
				});
				mergeMembershipUpdate({
					roleCode: {
						ms,
						by_ms: callerMs,
						num: newRoleCodeNum,
					},
				});
			} catch (error) {
				alertError(error);
			}
		}
	};
</script>

<div class="fx h-8">
	<a class="flex-1 fx hover:text-fg1 hover:bg-bg4" href={`/_${accepteeMs}_`}>
		{#if memberIsOwner}
			<IconCrownFilled />
		{:else if memberIsMod}
			<IconShieldFilled />
		{/if}
		<AccountIcon ms={accepteeMs} class="mx-1 h-6 w-6" />
		<p class={`font-medium text-lg ${gs.msToProfileMap[accepteeMs]?.name.txt ? '' : 'italic'}`}>
			{accepteeName}
			{#if membershipFlair.txt}
				<span class="text-fg2">
					{membershipFlair.txt}
				</span>
			{/if}
		</p>
	</a>
	{#if moreOptionsShown}
		{#if membershipIsByCaller || callerIsOwner}
			<button
				class="h-8 w-8 xy hover:bg-bg4"
				onclick={async () => {
					if (
						spaceMs &&
						callerMs &&
						(membershipIsByCaller
							? promptSum((a, b) => m.enterTheSumOfAAndBToLeaveTheSpace({ a, b }))
							: confirm(m.youAreAboutToRemoveAFromTheSpace({ a: accepteeName })))
					) {
						try {
							await trpc().removeSpaceMember.mutate({
								...(await getWhoWhereObj()),
								accountMs: accepteeMs,
							});
							if (membershipIsByCaller && !space.isPublic.num) goto('/__0');
							updateLocalCache((lc) => {
								lc.msToSpaceMap = {
									...lc.msToSpaceMap,
									[spaceMs]: {
										...lc.msToSpaceMap[spaceMs],
										memberCount: space.memberCount - 1,
									},
								};
								if (membershipIsByCaller) {
									lc.accounts[0].joinedSpaceContexts = lc.accounts[0].joinedSpaceContexts.filter(
										(sc) => sc.ms !== spaceMs,
									);
								}
								return lc;
							});
							gs.spaceMsToAccountMsToMembershipMap = {
								...gs.spaceMsToAccountMsToMembershipMap,
								[spaceMs]: {
									...gs.spaceMsToAccountMsToMembershipMap[spaceMs],
									[accepteeMs]: null,
								},
							};
						} catch (error) {
							alertError(error);
						}
					}
				}}
			>
				<IconUserMinus class="h-5" />
			</button>
		{/if}
		{#if (callerIsOwner && accepteeMs !== callerMs) || (membershipIsByCaller && callerIsMod)}
			<button
				class="h-full shrink-0 w-8 xy hover:bg-bg4"
				onclick={() => setRole(memberIsMod ? roleCodes.member : roleCodes.mod)}
			>
				{#if memberIsMod}
					<IconShieldOff class="h-5" />
				{:else}
					<IconShield class="h-5" />
				{/if}
			</button>
		{/if}
		{#if callerIsOwner && memberIsModOrOwner}
			<button
				class="h-full shrink-0 w-8 xy hover:bg-bg4"
				onclick={() => setRole(memberIsOwner ? roleCodes.mod : roleCodes.owner)}
			>
				{#if memberIsOwner}
					<IconCrownOff class="h-5" />
				{:else}
					<IconCrown class="h-5" />
				{/if}
			</button>
		{/if}
		{#if !membershipIsByCaller && authorityOverMember}
			<button
				class="h-full shrink-0 w-8 xy hover:bg-bg4"
				onclick={() => setPermission(true, false)}
			>
				{#if canReact}
					<IconMoodOff class="h-5" />
				{:else}
					<IconMoodPlus class="h-5" />
				{/if}
			</button>
			<button
				class="h-full shrink-0 w-8 xy hover:bg-bg4"
				onclick={() => setPermission(false, true)}
			>
				{#if canPost}
					<IconPencilOff class="h-5" />
				{:else}
					<IconPencilPlus class="h-5" />
				{/if}
			</button>
		{/if}
		{#if membershipIsByCaller || (callerIsOwner && !memberIsOwner) || (callerIsMod && !memberIsModOrOwner)}
			<button
				class="h-full shrink-0 w-8 xy hover:bg-bg4"
				onclick={async () => {
					let newFlairTxt = prompt(m.setFlair(), p.membership.flair.txt);
					if (newFlairTxt !== null) {
						let { ms } = await trpc().setSpaceMemberFlair.mutate({
							...(await getWhoWhereObj()),
							accountMs: accepteeMs,
							flairTxt: newFlairTxt,
						});
						mergeMembershipUpdate({
							flair: {
								ms,
								by_ms: callerMs,
								txt: newFlairTxt,
							},
						});
					}
				}}
			>
				<IconFlag3 class="h-5" />
			</button>
		{/if}
	{/if}
	{#if authorityOverMember || membershipIsByCaller}
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
	{#if membershipFlair.txt}
		<div class="fx justify-between">
			{#if membershipFlair.by_ms === accepteeMs}
				<p class="mr-1">{m.flairSetBySelf()}</p>
			{:else}
				<p class="mr-1">{m.flairSetBy()}</p>
				<a class="flex-1 fx hover:text-fg1 hover:bg-bg4" href={`/_${membershipFlair.by_ms}_`}>
					<AccountIcon isSystem class="h-5 w-5 mr-0.5" ms={membershipFlair.by_ms!} />
					{msToAccountNameTxt(membershipFlair.by_ms!, true)}
				</a>
			{/if}
			<p>{formatMs(membershipFlair.ms!, 'day')}</p>
		</div>
	{/if}
	<div class="fx justify-between">
		<p class="mr-1">{m.acceptedInviteBy()}</p>
		<a class="flex-1 fx hover:text-fg1 hover:bg-bg4" href={`/_${p.membership.invite.by_ms}_`}>
			<AccountIcon isSystem class="h-5 w-5 mr-0.5" ms={p.membership.invite.by_ms} />
			{msToAccountNameTxt(p.membership.invite.by_ms, true)}
		</a>
		<p>{formatMs(p.membership.accept.ms, 'day')}</p>
	</div>
	<div class="fx justify-between">
		{#if membershipRoleCode.by_ms === accepteeMs}
			<p class="mr-1">{memberIsMod ? m.assignedSelfToMod() : m.assignedSelfToMember()}</p>
		{:else}
			<p class="mr-1">{roleText}</p>
			<a class="flex-1 fx hover:text-fg1 hover:bg-bg4" href={`/_${membershipRoleCode.by_ms}_`}>
				<AccountIcon isSystem class="h-5 w-5 mr-0.5" ms={membershipRoleCode.by_ms!} />
				{msToAccountNameTxt(membershipRoleCode.by_ms!, true)}
			</a>
		{/if}
		<p>{formatMs(membershipRoleCode.ms!, 'day')}</p>
	</div>
	<div class="fx justify-between">
		<p class="mr-1">{permissionText}</p>
		<a
			class="flex-1 fx hover:text-fg1 hover:bg-bg4"
			href={`/_${p.membership.permissionCode.by_ms}_`}
		>
			<AccountIcon isSystem class="h-5 w-5 mr-0.5" ms={p.membership.permissionCode.by_ms!} />
			{msToAccountNameTxt(p.membership.permissionCode.by_ms!, true)}
		</a>
		<p>{formatMs(p.membership.permissionCode.ms!, 'day')}</p>
	</div>
</div>
