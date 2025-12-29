<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { getWhoObj } from '$lib/types/parts';
	import { IconChevronRight } from '@tabler/icons-svelte';

	let validInvite = $state(true);

	$effect(() => {
		(async () => {
			if (page.params.inviteSlug) {
				let pendingInvite = (
					await trpc().checkInvite.mutate({
						...(await getWhoObj()),
						inviteSlug: page.params.inviteSlug,
						useIfValid: false,
					})
				).invite;
				if (!pendingInvite) validInvite = false;
				else {
					gs.pendingInvite = pendingInvite;
					gs.msToSpaceMap = {
						...gs.msToSpaceMap,
						[pendingInvite.in_ms]: {
							ms: pendingInvite.in_ms,
							name: pendingInvite.spaceName,
						},
					};
					goto(`/__${pendingInvite.in_ms}`);
				}
			}
		})();
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
