<script lang="ts">
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { msToAccountNameTxt, type OtherAccount } from '$lib/types/accounts';
	import { spaceMsToName, type Space } from '$lib/types/spaces';
	import { IconDeviceFloppy, IconEdit, IconLockFilled, IconX } from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	type Changes = {
		nameTxt?: string;
		bioTxt?: string;
		descriptionTxt?: string;
		isPublicBin?: number;
		newUsersCanReactBin?: number;
		newUsersCanPostBin?: number;
	};

	let p: {
		account?: OtherAccount;
		space?: Space;
		onChange: (changes: Changes) => void;
	} = $props();

	let currentSettings = $derived({
		name: p.space?.name || p.account!.name,
		bioOrDescription: p.account?.bio || p.space!.description,
		isPublic: p.space?.isPublic,
		newUsersCanReact: p.space?.newUsersCanReact,
		newUsersCanPost: p.space?.newUsersCanPost,
	});
	let editing = $state(false);
	let draftSettings = $state((() => ({ ...currentSettings }))());

	$effect(() => {
		draftSettings = { ...currentSettings };
	});

	let accountOrSpaceMs = $derived(p.account?.ms ?? p.space!.ms);
	let slug = $derived(p.account ? `_${p.account.ms}_` : `__${p.space?.ms}`);

	let userCanEdit = $derived.by(() => {
		if (accountOrSpaceMs) {
			if (p.space) {
				// if owner => true
			}
			if (p.account && gs.accounts) {
				return p.account.ms === gs.accounts[0].ms;
			}
		}
		return false;
	});
</script>

<div class="w-full max-w-lg">
	<div class="flex justify-between h-10">
		{#if p.account}
			<AccountIcon class="h-10 w-10" ms={accountOrSpaceMs} />
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
						if (draftSettings.name.txt.trim() !== currentSettings.name.txt) {
							changes.nameTxt = draftSettings.name.txt.trim();
						}
						if (
							draftSettings.bioOrDescription.txt.trim() !== currentSettings.bioOrDescription.txt
						) {
							if (p.account) changes.bioTxt = draftSettings.bioOrDescription.txt.trim();
							else changes.descriptionTxt = draftSettings.bioOrDescription.txt.trim();
						}
						if (
							draftSettings.isPublic &&
							draftSettings.isPublic.num !== currentSettings.isPublic?.num
						) {
							changes.isPublicBin = draftSettings.isPublic.num;
						}
						if (
							draftSettings.newUsersCanReact &&
							draftSettings.newUsersCanReact.num !== currentSettings.newUsersCanReact?.num
						) {
							changes.newUsersCanReactBin = draftSettings.newUsersCanReact.num;
						}
						if (
							draftSettings.newUsersCanPost &&
							draftSettings.newUsersCanPost.num !== currentSettings.newUsersCanPost?.num
						) {
							changes.newUsersCanPostBin = draftSettings.newUsersCanPost.num;
						}
						p.onChange(changes);
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
			bind:value={draftSettings.name}
			class="w-full px-2 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4"
		/>
		<p class="mt-1 font-bold">{p.account ? m.bio() : m.description()}</p>
		<textarea
			bind:value={draftSettings.bioOrDescription}
			class="resize-y w-full px-2 py-0.5 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4 block"
		></textarea>
		{#if p.space}
			<div class="mt-2 flex">
				<div class="flex-1">
					<p class="text-sm font-bold">{m.visibility()}</p>
					<select
						name={m.visibility()}
						class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
						bind:value={draftSettings.isPublic}
					>
						<option value={false}>{m.private()}</option>
						<option value={true}>{m.public()}</option>
					</select>
				</div>
				<div class="flex-2">
					<p class="text-sm font-bold">{m.newMembers()}</p>
					<div class="flex">
						<select
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
							bind:value={draftSettings.newUsersCanReact}
						>
							<option value={false}>{m.cannotReact()}</option>
							<option value={true}>{m.canReact()}</option>
						</select>
						<select
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
							bind:value={draftSettings.newUsersCanPost}
						>
							<option value={false}>{m.cannotPost()}</option>
							<option value={true}>{m.canPost()}</option>
						</select>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="flex">
			<p class="text-xl font-bold">
				{draftSettings.name.txt ||
					(p.account ? msToAccountNameTxt : spaceMsToName)(accountOrSpaceMs).txt}
			</p>
			{#if p.space && !p.space.isPublic}
				<IconLockFilled class="self-center h-5 mb-0.5" />
			{/if}
			{#if accountOrSpaceMs > 8}
				<p class="self-end ml-1 text-fg2">{identikana(accountOrSpaceMs)}</p>
			{/if}
		</div>
		<div class="text-sm overflow-scroll gap-2 fx justify-between text-nowrap text-fg2">
			<a class="hover:text-fg1 hover:underline hover:bg-bg3" href={`${page.url.origin}/${slug}`}>
				{slug}
			</a>
			{#if accountOrSpaceMs}
				<p class="">{m.createdD({ d: formatMs(accountOrSpaceMs, 'day') })}</p>
			{/if}
		</div>
		<p class="">{draftSettings.bioOrDescription.txt}</p>
	{/if}
</div>
