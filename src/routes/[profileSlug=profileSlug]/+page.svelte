<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getWhoObj, gs, msToSpaceNameTxt } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { type MyAccount, type PublicProfile } from '$lib/types/accounts';
	import { signOut } from '$lib/types/local-cache';
	import { IconChevronRight, IconLogout2, IconMail } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import SpaceIcon from '../SpaceIcon.svelte';
	import SpaceOrAccountHeader from '../SpaceOrAccountHeader.svelte';
	let p: { profileMs: number } = $props();

	let publicProfile = $state<null | (PublicProfile & Partial<MyAccount>)>();
	let profileMs = $derived(+page.params.profileSlug!.slice(1, -1));
	onMount(async () => {
		let whoObj = await getWhoObj();

		publicProfile =
			profileMs === gs.accounts?.[0].ms
				? { ...gs.accounts[0], mutualSpaceMss: [] }
				: (await trpc().getPublicProfile.query({
						...whoObj,
						profileMs,
						...(whoObj.callerMs //
							? { possibleMutualSpaceMss: gs.accounts?.[0].joinedSpaceContexts.map((j) => j.ms) }
							: {}),
					})) || null;

		if (publicProfile) {
			gs.msToProfileMap = {
				...gs.msToProfileMap,
				[publicProfile.ms]: publicProfile,
			};
		}
	});
</script>

{#if publicProfile === null}
	<!--  -->
{:else if publicProfile}
	<div class="p-2 max-w-lg">
		<SpaceOrAccountHeader account={publicProfile} />
		{#if publicProfile.ms}
			{#if publicProfile.ms === gs.accounts?.[0].ms}
				<div class="h-0.5 mt-2 w-full bg-bg8"></div>
				<p class="text-sm text-fg2">{m.private()}</p>
				<button
					class="px-2 h-9 xy bg-bg4 border-b-2 border-emerald-400 dark:border-emerald-500 hover:bg-bg7 hover:text-fg3 hover:border-emerald-500 dark:hover:border-emerald-400"
					onclick={() => alert(publicProfile?.email?.txt)}
				>
					<IconMail class="w-5 mr-1" />
					{m.showEmail()}
				</button>
				<button
					class="px-2 h-9 xy bg-bg4 border-b-2 border-orange-400 dark:border-orange-500 hover:bg-bg7 hover:text-fg3 hover:border-orange-500 dark:hover:border-orange-400"
					onclick={() => signOut(gs.accounts![0].ms, true)}
				>
					<IconLogout2 class="w-5 mr-1" />
					{m.signOutEverywhere()}
				</button>
				<a
					href="/reset-password"
					onclick={(e) => {
						if (!e.metaKey && !e.metaKey && !e.metaKey) {
							e.preventDefault();
							goto('/reset-password', { state: { prefilledEmail: publicProfile!.email!.txt } });
						}
					}}
					class="inline-flex pl-2 h-9 xy bg-bg4 border-b-2 border-slate-400 dark:border-slate-500 hover:bg-bg7 hover:text-fg3 hover:border-slate-500 dark:hover:border-slate-400"
					>{m.resetPassword()}
					<IconChevronRight class="w-5 ml-1" />
				</a>
			{/if}
			{#if publicProfile?.mutualSpaceMss?.length}
				<div class="h-0.5 mt-2 w-full bg-bg8"></div>
				<p class="text-xl font-bold">{m.mutualSpaces()}</p>
				{#each publicProfile.mutualSpaceMss as mutualSpaceMs}
					<a
						href={`/__${mutualSpaceMs}?q=by:${page.params.profileSlug}`}
						class="h-9 fx hover:bg-bg3 w-full"
					>
						<SpaceIcon ms={mutualSpaceMs} />
						<p class="ml-2 text-lg font-bold">{msToSpaceNameTxt(mutualSpaceMs)}</p>
					</a>
				{/each}
			{:else}
				<p class="text-fg2">No mutual spaces</p>
			{/if}
		{/if}
	</div>
{/if}
