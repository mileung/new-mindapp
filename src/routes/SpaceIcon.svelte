<script lang="ts">
	import { IconBrowser, IconUser, IconWorld } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		ms?: null | number;
		class?: string;
	} = $props();
</script>

{#if p.ms === null || p.ms === undefined}
	<IconBrowser class={`text-local ${p.class}`} />
{:else if p.ms === 1}
	<IconWorld class={`text-global ${p.class}`} />
{:else if p.ms === 0}
	<IconUser class={`text-personal ${p.class}`} />
{:else}
	<Identicon data={'' + p.ms} class={p.class} />
{/if}
