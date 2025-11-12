<script lang="ts">
	import { IconUserFilled } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		ms?: null | number;
		class?: string;
	} = $props();
</script>

{#if p.ms === null || p.ms === undefined}
	<IconUserFilled class={`text-fg1 ${p.class}`} />
{:else}
	<Identicon data={'' + p.ms} class={p.class} />
{/if}
