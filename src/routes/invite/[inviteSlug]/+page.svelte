<script lang="ts">
	import { page } from '$app/state';
	import {
		getWhoObj,
		gs,
		mergeMsToSpaceNameTxtMap,
		msToAccountNameTxt,
		msToSpaceNameTxt,
	} from '$lib/global-state.svelte';
	import { splitUntil } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { useCheckedInvite } from '$lib/types/local-cache';
	import { IconChevronRight } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import AccountIcon from '../../AccountIcon.svelte';
	import SpaceIcon from '../../SpaceIcon.svelte';

	let validInvite = $state(true);

	onMount(async () => {
		if (!page.params.inviteSlug) return;
		let [inviteMsStr, slugEnd] = splitUntil(page.params.inviteSlug, '_', 1);
		let inviteMs = +inviteMsStr;
		if (Number.isNaN(inviteMs) || slugEnd.length > 8) return (validInvite = false);
		let { checkedInvite } = await trpc().checkInvite.mutate({
			...(await getWhoObj()),
			inviteMs,
			slugEnd,
			useIfValid: false,
		});
		if (checkedInvite) {
			gs.msToProfileMap = {
				...gs.msToProfileMap,
				[checkedInvite.inviter.ms]: checkedInvite.inviter,
			};
			mergeMsToSpaceNameTxtMap({
				[checkedInvite.partialSpace.ms]: checkedInvite.partialSpace.name.txt,
			});
			gs.checkedInvite = { ...checkedInvite, ms: inviteMs, slugEnd };
		} else validInvite = false;
	});

	let actionButtonClass = $derived(
		'inline-flex mt-2 fx z-50 h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-2 border-hl1 hover:border-hl2',
	);
</script>

<div class="p-2 pt-0 w-full max-w-sm">
	{#if !validInvite}
		<p class="h-9 fx font-bold text-xl">{m.invalidInvite()}</p>
		<p class="">
			{m.thisInviteLinkMayHave___()}
		</p>
		<a href={`/__${gs.lastSeenInMs}`} class={actionButtonClass}>
			{m.continue()}
			<IconChevronRight class="h-5" stroke={3} />
		</a>
	{:else if gs.checkedInvite}
		<div class="h-9 fx">
			<SpaceIcon ms={gs.checkedInvite.partialSpace.ms} class="shrink-0 w-6 ml-0.5 mr-2" />
			<p class="font-bold text-xl truncate">{msToSpaceNameTxt(gs.checkedInvite.partialSpace.ms)}</p>
		</div>
		<div class="fx justify-between">
			<div class="fx">
				<AccountIcon isSystem ms={gs.checkedInvite.inviter.ms} class="h-5 w-5 mr-1" />
				<p class="">
					{m.nameInvitedYou({ n: msToAccountNameTxt(gs.checkedInvite.inviter.ms, true) })}
				</p>
			</div>
			<p class="">
				{gs.checkedInvite.partialSpace.memberCount === 1
					? m.oneMember()
					: m.nMembers({ n: gs.checkedInvite.partialSpace.memberCount })}
			</p>
		</div>
		<p class="">{gs.checkedInvite.partialSpace.description.txt}</p>
		{#if gs.accounts?.[0].ms}
			<button onclick={useCheckedInvite} class={actionButtonClass}>
				{m.joinSpace()}
				<IconChevronRight class="h-5" stroke={3} />
			</button>
		{:else}
			<a href="/sign-in" class={actionButtonClass}>
				{m.signInAndJoin()}
				<IconChevronRight class="h-5" stroke={3} />
			</a>
		{/if}
	{/if}
</div>
