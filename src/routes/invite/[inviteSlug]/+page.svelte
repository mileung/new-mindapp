<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { getWhoObj } from '$lib/types/parts';
	import { IconChevronRight } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';

	let validInvite = $state(true);

	onMount(async () => {
		if (!page.params.inviteSlug) return;
		let pendingInvite = (
			await trpc().checkInvite.mutate({
				...(await getWhoObj()),
				inviteSlug: page.params.inviteSlug,
				useIfValid: false,
			})
		).invite;
		if (pendingInvite) {
			gs.pendingInvite = pendingInvite;
			goto(`/__${pendingInvite.in_ms}`);
		} else validInvite = false;
	});
</script>

{#if !validInvite}
	<div class="h-screen xy fy gap-2">
		<p class="text-2xl font-black">{m.invalidInvite()}</p>
		<a
			href={`/__${gs.currentSpaceMs}`}
			class="fx h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-2 border-hl1 hover:border-hl2"
		>
			{m.goHome()}
			<IconChevronRight class="h-5" stroke={3} />
		</a>
	</div>
{/if}
