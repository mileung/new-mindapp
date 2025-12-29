<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { IconChevronRight } from '@tabler/icons-svelte';
</script>

<div class={`xy fy gap-2 p-2 ${!gs.pendingInvite ? 'min-h-screen' : 'min-h-[calc(100vh-36px)]'}`}>
	<p class="text-2xl font-black">{m.signInToViewThisPage()}</p>
	<a
		href="/sign-in"
		class="fx h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-4 border-hl1 hover:border-hl2"
	>
		{m.addAccount()}
		<IconChevronRight class="h-5" stroke={3} />
	</a>
</div>
