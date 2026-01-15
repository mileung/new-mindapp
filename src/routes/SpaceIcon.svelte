<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { IconBrowser, IconUser, IconWorld } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		ms: number;
		class?: string;
	} = $props();
</script>

{#if p.ms === 0}
	<IconBrowser class={`text-local ${p.class}`} />
{:else if p.ms === 1}
	<IconWorld class={`text-global ${p.class}`} />
{:else if p.ms === 8 || p.ms === gs.accounts?.[0].ms}
	<IconUser class={`text-personal ${p.class}`} />
{:else}
	<Identicon {...p} />
{/if}
