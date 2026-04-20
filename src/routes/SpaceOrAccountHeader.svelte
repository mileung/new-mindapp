<script lang="ts">
	import {
		getUrlInMsContext,
		getWhoWhereObj,
		gs,
		msToAccountNameTxt,
		msToSpaceNameTxt,
	} from '$lib/global-state.svelte';
	import { deepClone, identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { type PublicProfile } from '$lib/types/accounts';
	import { updateLocalCache } from '$lib/types/local-cache';
	import { permissionCodes, roleCodes, type Space } from '$lib/types/spaces';
	import { IconDeviceFloppy, IconEdit, IconX } from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	type Changes = {
		nameTxt?: string;
		bioTxt?: string;
		descriptionTxt?: string;
		pinnedQueryTxt?: string;
		isPublicNum?: number;
		newMemberPermissionCodeNum?: number;
	};

	let p: {
		account?: PublicProfile;
		space?: Space;
	} = $props();
	let currentSettings = $derived({
		isPublicNum: p.space?.isPublic?.num || 0,
		nameTxt: (p.space || p.account)?.name?.txt || '',
		bioOrDescriptionTxt: p.space?.description?.txt || p.account?.bio?.txt || '',
		pinnedQueryTxt: p.space?.pinnedQuery?.txt || '',
		newMemberPermissionCodeNum: p.space?.newMemberPermissionCode?.num || 0,
	});
	let editing = $state(false);
	let draftSettings = $state((() => deepClone(currentSettings))());

	$effect(() => {
		draftSettings = deepClone(currentSettings);
	});

	$effect(() => {
		if (p.space) editing = false;
	});

	let accountOrSpaceMs = $derived(p.account?.ms ?? p.space!.ms);
	let slug = $derived(p.account ? `_${p.account.ms}_` : `__${p.space?.ms}`);

	let callerMs = $derived(gs.accounts?.[0].ms);
	let spaceContext = $derived(getUrlInMsContext());
	let userCanEdit = $derived.by(() => {
		if (accountOrSpaceMs && gs.accounts) {
			if (p.space) return spaceContext?.roleCode?.num === roleCodes.owner;
			if (p.account) return p.account.ms === callerMs;
		}
		return false;
	});

	let spaceNote = $derived(
		p.space &&
			(gs.lastSeenInMs === gs.accounts?.[0].ms
				? m.personalSpaceNote()
				: gs.lastSeenInMs === 1
					? m.globalSpaceNote()
					: !gs.lastSeenInMs && m.localSpaceNote()),
	);

	let visibilityAndNewMembersCan = $derived.by(() => {
		if (
			p.space?.ms &&
			p.space?.ms !== callerMs &&
			draftSettings.isPublicNum !== undefined &&
			draftSettings.newMemberPermissionCodeNum !== undefined
		) {
			let visibilityTxt = draftSettings.isPublicNum ? m.public() : m.private();
			let newMemberPermissionTxt = {
				[permissionCodes.viewOnly]: m.newMembersCanOnlyView(),
				[permissionCodes.reactOnly]: m.newMembersCanReact(),
				[permissionCodes.postOnly]: m.newMembersCanPost(),
				[permissionCodes.reactAndPost]: m.newMembersCanReactPost(),
			}[draftSettings.newMemberPermissionCodeNum];
			return `${visibilityTxt} - ${newMemberPermissionTxt}`;
		}
	});
</script>

<div class="w-full max-w-lg">
	<div class="flex justify-between h-10">
		{#if p.account}
			<AccountIcon isUser class="h-10 w-10" ms={accountOrSpaceMs} />
		{:else}
			<SpaceIcon class="h-10 w-10" ms={accountOrSpaceMs} />
		{/if}
		{#if editing}
			<div class="flex h-8">
				<button
					class="w-8 xy hover:bg-bg3 text-fg2 hover:text-fg1"
					onclick={() => {
						draftSettings = { ...currentSettings };
						editing = false;
					}}
				>
					<IconX class="w-5" />
				</button>
				<button
					class="xy pl-0.5 pr-1 border-b-2 border-hl1 hover:border-hl2 bg-bg2 hover:bg-bg4 hover:text-fg3"
					onclick={async () => {
						editing = false;
						let changes: Changes = {};
						if (draftSettings.nameTxt.trim() !== currentSettings.nameTxt)
							changes.nameTxt = draftSettings.nameTxt.trim();
						if (draftSettings.bioOrDescriptionTxt.trim() !== currentSettings.bioOrDescriptionTxt) {
							if (p.account) changes.bioTxt = draftSettings.bioOrDescriptionTxt.trim();
							else changes.descriptionTxt = draftSettings.bioOrDescriptionTxt.trim();
						}
						if (draftSettings.pinnedQueryTxt !== currentSettings.pinnedQueryTxt)
							changes.pinnedQueryTxt = draftSettings.pinnedQueryTxt.trim();
						if (draftSettings.isPublicNum !== currentSettings.isPublicNum)
							changes.isPublicNum = draftSettings.isPublicNum;
						if (
							draftSettings.newMemberPermissionCodeNum !==
							currentSettings.newMemberPermissionCodeNum
						)
							changes.newMemberPermissionCodeNum = draftSettings.newMemberPermissionCodeNum;
						if (Object.keys(changes).length) {
							let { ms } = await (
								p.space ? trpc().changeSpaceAttributes : trpc().changeMyAccountAttributes
							).mutate({
								...(await getWhoWhereObj()),
								...changes,
							});
							updateLocalCache((lc) => {
								if (p.account) {
									if (changes.nameTxt !== undefined)
										lc.accounts[0].name = { ms, txt: changes.nameTxt };
									if (changes.bioTxt !== undefined)
										lc.accounts[0].bio = { ms, txt: changes.bioTxt };
								}
								if (p.space) {
									if (changes.nameTxt !== undefined)
										lc.msToSpaceMap[p.space.ms]!.name = { ms, txt: changes.nameTxt };
									if (changes.descriptionTxt !== undefined)
										lc.msToSpaceMap[p.space.ms]!.description = { ms, txt: changes.descriptionTxt };
									if (changes.pinnedQueryTxt !== undefined)
										lc.msToSpaceMap[p.space.ms]!.pinnedQuery = { ms, txt: changes.pinnedQueryTxt };
									if (changes.isPublicNum !== undefined)
										lc.msToSpaceMap[p.space.ms]!.isPublic = { ms, num: changes.isPublicNum };
									if (changes.newMemberPermissionCodeNum !== undefined) {
										lc.msToSpaceMap[p.space.ms]!.newMemberPermissionCode = {
											ms,
											num: changes.newMemberPermissionCodeNum,
										};
									}
								}
								return lc;
							});
						}
					}}
				>
					<IconDeviceFloppy class="w-5 mr-1" />
					{m.save()}
				</button>
			</div>
		{:else if userCanEdit}
			<button
				class="h-8 xy pl-0.5 pr-1 hover:bg-bg4 text-fg2 hover:text-fg1"
				onclick={() => (editing = true)}
			>
				<IconEdit class="w-5 mr-1" />
				{m.edit()}
			</button>
		{/if}
	</div>
	{#if editing}
		{#if p.space ? p.space.ms > 1 && p.space.ms !== callerMs : true}
			<p class="font-bold">{m.name()}</p>
			<input
				bind:value={draftSettings.nameTxt}
				class="w-full px-2 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4"
			/>
		{:else}
			<p class="text-xl font-bold">
				{msToSpaceNameTxt(accountOrSpaceMs)}
			</p>
		{/if}
		<p class="mt-1 font-bold">{p.account ? m.bio() : m.description()}</p>
		<textarea
			bind:value={draftSettings.bioOrDescriptionTxt}
			class="resize-y w-full px-2 py-0.5 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4 block"
		></textarea>
		<p class="font-bold">{m.pinnedQuery()}</p>
		<input
			bind:value={draftSettings.pinnedQueryTxt}
			class="w-full px-2 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4"
		/>
		{#if p.space && p.space.ms !== callerMs}
			<div class="mt-2 flex">
				<div class="flex-1">
					<p class="text-sm font-bold">{m.visibility()}</p>
					<select
						name={m.visibility()}
						class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
						bind:value={draftSettings.isPublicNum}
					>
						<option value={0} disabled={p.space.ms === 1}>{m.private()}</option>
						<option value={1} disabled={p.account?.ms === gs.accounts?.[0].ms}>{m.public()}</option>
					</select>
				</div>
				<div class="flex-1">
					<p class="text-sm font-bold">{m.newMembers()}</p>
					<div class="flex">
						<select
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
							bind:value={draftSettings.newMemberPermissionCodeNum}
						>
							<option value={permissionCodes.viewOnly}>{m.viewOnly()}</option>
							<option value={permissionCodes.reactOnly}>{m.canReact()}</option>
							<option value={permissionCodes.postOnly}>{m.canPost()}</option>
							<option value={permissionCodes.reactAndPost}>{m.canReactAndPost()}</option>
						</select>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="flex">
			<p class="text-xl font-bold">
				{(p.account ? msToAccountNameTxt : msToSpaceNameTxt)(accountOrSpaceMs)}
			</p>
			{#if draftSettings.nameTxt}
				<p class="self-end ml-1 text-fg2">
					{(accountOrSpaceMs > 8
						? identikana
						: p.space //
							? msToSpaceNameTxt
							: msToAccountNameTxt)(accountOrSpaceMs)}
				</p>
			{/if}
		</div>
		<p class="whitespace-pre-wrap">{draftSettings.bioOrDescriptionTxt}</p>
		{#if draftSettings.pinnedQueryTxt}
			<a
				class="text-fg1 hover:text-fg3 underline decoration-fg1 hover:decoration-fg3"
				href={`/__${accountOrSpaceMs}?q=${draftSettings.pinnedQueryTxt}`}
				>{m.pinnedQuery()}: {draftSettings.pinnedQueryTxt}</a
			>
		{:else if p.space}
			<p class="text-fg2">{m.nothingPinned()}</p>
		{/if}
		{#if visibilityAndNewMembersCan}
			<p class="text-fg2">{visibilityAndNewMembersCan}</p>
		{/if}
		{#if spaceNote}<p class="text-fg2">{spaceNote}</p>{/if}
	{/if}
</div>
