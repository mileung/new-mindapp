<script lang="ts">
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { deepClone, identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { accountMsToNameTxt, type Profile } from '$lib/types/accounts';
	import { permissionCodes, roleCodes, spaceMsToNameTxt, type Space } from '$lib/types/spaces';
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
		account?: Profile;
		space?: Space;
		onChange: (changes: Changes) => void;
	} = $props();
	let currentSettings = $derived({
		isPublicNum: p.space?.isPublic.num,
		nameTxt: (p.space || p.account)!.name.txt,
		bioOrDescriptionTxt: p.space?.description.txt || p.account?.bio.txt || '',
		pinnedQueryTxt: p.space?.pinnedQuery.txt,
		newMemberPermissionCodeNum: p.space?.newMemberPermissionCode.num,
	});
	let editing = $state(false);
	let draftSettings = $state((() => deepClone(currentSettings))());

	$effect(() => {
		draftSettings = deepClone(currentSettings);
	});

	let accountOrSpaceMs = $derived(p.account?.ms ?? p.space!.ms);
	let slug = $derived(p.account ? `_${p.account.ms}_` : `__${p.space?.ms}`);

	let spaceContext = $derived(gs.accounts?.[0].spaceMsToContextMap[gs.urlInMs || 0]);
	let userCanEdit = $derived.by(() => {
		if (accountOrSpaceMs && gs.accounts) {
			if (p.space) return spaceContext?.roleCode?.num === roleCodes.owner;
			if (p.account) return p.account.ms === gs.accounts[0].ms;
		}
		return false;
	});

	let spaceNote = $derived(
		gs.urlInMs === gs.accounts?.[0].ms
			? m.personalSpaceNote()
			: gs.urlInMs === 1
				? m.globalSpaceNote()
				: !gs.urlInMs && m.localSpaceNote(),
	);
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
					onclick={() => {
						editing = false;
						let changes: Changes = {};
						if (draftSettings.nameTxt.trim() !== currentSettings.nameTxt) {
							changes.nameTxt = draftSettings.nameTxt.trim();
						}
						if (draftSettings.bioOrDescriptionTxt.trim() !== currentSettings.bioOrDescriptionTxt) {
							if (p.account) changes.bioTxt = draftSettings.bioOrDescriptionTxt.trim();
							else changes.descriptionTxt = draftSettings.bioOrDescriptionTxt.trim();
						}
						if (
							currentSettings.isPublicNum &&
							draftSettings.isPublicNum !== currentSettings.isPublicNum
						) {
							changes.isPublicNum = draftSettings.isPublicNum;
						}
						if (draftSettings.pinnedQueryTxt !== currentSettings.pinnedQueryTxt) {
							changes.pinnedQueryTxt = draftSettings.pinnedQueryTxt;
						}
						if (
							draftSettings.newMemberPermissionCodeNum !==
							currentSettings.newMemberPermissionCodeNum
						) {
							changes.newMemberPermissionCodeNum = draftSettings.newMemberPermissionCodeNum;
						}
						console.log('changes:', changes);
						if (Object.keys(changes).length) p.onChange(changes);
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
		<p class="font-bold">{m.name()}</p>
		<input
			bind:value={draftSettings.nameTxt}
			class="w-full px-2 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4"
		/>
		<p class="mt-1 font-bold">{p.account ? m.bio() : m.description()}</p>
		<textarea
			bind:value={draftSettings.bioOrDescriptionTxt}
			class="resize-y w-full px-2 py-0.5 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4 block"
		></textarea>
		{#if p.space}
			<div class="mt-2 flex">
				<div class="flex-1">
					<p class="text-sm font-bold">{m.visibility()}</p>
					<select
						name={m.visibility()}
						class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
						bind:value={draftSettings.isPublicNum}
					>
						<option value={0}>{m.private()}</option>
						<option value={1}>{m.public()}</option>
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
				{(p.account ? accountMsToNameTxt : spaceMsToNameTxt)(accountOrSpaceMs)}
			</p>
			{#if draftSettings.nameTxt}
				<p class="self-end ml-1 text-fg2">
					{(accountOrSpaceMs > 8
						? identikana
						: p.space //
							? spaceMsToNameTxt
							: accountMsToNameTxt)(accountOrSpaceMs)}
				</p>
			{/if}
		</div>
		<div class="text-sm overflow-scroll gap-2 fx justify-between text-nowrap text-fg2">
			<a class="hover:text-fg1 hover:underline hover:bg-bg3" href={`${page.url.origin}/${slug}`}>
				{slug}
			</a>
			{#if accountOrSpaceMs > 1}
				<p class="">{m.createdD({ d: formatMs(accountOrSpaceMs, 'day') })}</p>
			{/if}
		</div>
		<p class="whitespace-pre-wrap">{draftSettings.bioOrDescriptionTxt}</p>
		{#if draftSettings.pinnedQueryTxt}
			<div class="fx">
				<a class="b" href={`/__${accountOrSpaceMs}?q=${draftSettings.pinnedQueryTxt}`}
					>{m.pinnedQuery()}</a
				>
				<p class="text-fg2">{draftSettings.pinnedQueryTxt}</p>
			</div>
		{:else}
			<p class="text-fg2">Nothing pinned</p>
		{/if}
		{#if spaceNote}<p class="text-fg2">{spaceNote}</p>{/if}
	{/if}
</div>
