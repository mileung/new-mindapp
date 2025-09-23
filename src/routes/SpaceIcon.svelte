<script lang="ts">
	import { IconBrowser, IconUser, IconWorld } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		id: string;
		class?: string;
	} = $props();
</script>

{#if p.id}
	{#if p.id === '1'}
		<IconWorld class={`text-global ${p.class}`} />
	{:else if p.id === '0'}
		<IconUser class={`text-personal ${p.class}`} />
	{:else}
		<Identicon data={p.id} class={p.class} />
	{/if}
{:else}
	<IconBrowser class={`text-local ${p.class}`} />
{/if}
