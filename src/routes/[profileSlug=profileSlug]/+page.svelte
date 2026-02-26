<script lang="ts">
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import type { MyAccount, Profile } from '$lib/types/accounts';
	import { signOut, updateLocalCache } from '$lib/types/local-cache';
	import { getWhoObj } from '$lib/types/parts';
	import { spaceMsToNameTxt } from '$lib/types/spaces';
	import { IconLogout2 } from '@tabler/icons-svelte';
	import SpaceIcon from '../SpaceIcon.svelte';
	import SpaceOrAccountHeader from '../SpaceOrAccountHeader.svelte';
	let p: { profileMs: number } = $props();

	let account = $state<null | (Profile & Partial<MyAccount>)>();

	let profileMs = $derived(+page.params.profileSlug!.slice(1, -1));
	$effect(() => {
		if (profileMs === gs.accounts?.[0].ms) {
			account = { ...gs.accounts[0], mutualSpaceMss: [] };
		}
	});

	let mutualSpaceMss = $derived([1]);
</script>

{#if account === null}
	<!--  -->
{:else if account}
	<div class="p-2 max-w-lg">
		<SpaceOrAccountHeader
			{account}
			onChange={async (changes) => {
				let { ms } = await trpc().changeMyAccountNameOrBio.mutate({
					...(await getWhoObj()),
					...changes,
				});
				updateLocalCache((lc) => {
					if (changes.nameTxt !== undefined) {
						lc.accounts[0].name = { ms, txt: changes.nameTxt };
					}
					if (changes.bioTxt !== undefined) {
						lc.accounts[0].bio = { ms, txt: changes.bioTxt };
					}
					return lc;
				});
			}}
		/>
		<div class="h-0.5 mt-2 w-full bg-bg8"></div>
		<p class="text-sm text-fg2">Private</p>
		<p class="my-1">{m.email()}: <span class="font-medium">{account.email?.txt}</span></p>
		<button
			class="xy px-2 py-1 bg-bg5 hover:bg-bg7 text-fg1"
			onclick={() => signOut(gs.accounts![0].ms, true)}
		>
			<IconLogout2 class="w-5 mr-1" />
			{m.signOutEverywhere()}
		</button>
		<div class="h-0.5 mt-2 w-full bg-bg8"></div>
		<p class="text-xl font-bold">Mutual spaces</p>
		{#each mutualSpaceMss as mutualSpaceMs}
			<a
				href={`/__${mutualSpaceMs}?q=by:${page.params.profileSlug}`}
				class="h-9 fx hover:bg-bg3 w-full"
			>
				<SpaceIcon ms={mutualSpaceMs} />
				<p class="ml-2 text-lg font-bold">{spaceMsToNameTxt(mutualSpaceMs)}</p>
			</a>
		{/each}
	</div>
{/if}
