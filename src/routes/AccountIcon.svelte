<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { IconCpu, IconUserFilled } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		ms: number;
		class?: string;
		isUser?: boolean;
		isSystem?: boolean;
	} = $props();
</script>

{#if p.ms === 0}
	{#if p.isSystem || (gs.currentSpaceMs && !p.isUser)}
		<IconCpu class={`text-fg1 ${p.class}`} />
	{:else}
		<IconUserFilled class={`text-fg1 ${p.class}`} />
	{/if}
{:else}
	<Identicon data={'' + p.ms} class={p.class} />
{/if}
