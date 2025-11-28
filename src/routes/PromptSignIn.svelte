<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { IconChevronRight } from '@tabler/icons-svelte';
</script>

<div class="h-screen xy fy gap-2">
	<p class="text-2xl font-black">{m.signInToUseThisSpace()}</p>
	<a
		href="/sign-in"
		class="fx h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 border-b-4 border-hl1 hover:border-hl2"
	>
		{m.addAccount()}
		<IconChevronRight class="h-5" stroke={3} />
	</a>
</div>
