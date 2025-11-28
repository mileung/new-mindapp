<script lang="ts">
	import { IconUserFilled } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		ms: number;
		class?: string;
	} = $props();
</script>

{#if p.ms === 0}
	<IconUserFilled class={`text-fg1 ${p.class}`} />
{:else}
	<Identicon data={'' + p.ms} class={p.class} />
{/if}
