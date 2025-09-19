<script lang="ts">
	import { IconBrowser, IconUser, IconWorld } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		id?: null | number;
		class?: string;
	} = $props();
</script>

{#if typeof p.id === 'number'}
	{#if p.id === 1}
		<IconWorld class={`text-global ${p.class}`} />
	{:else if !p.id}
		<IconUser class={`text-personal ${p.class}`} />
	{:else}
		<Identicon data={p.id + ''} class={p.class} />
	{/if}
{:else}
	<IconBrowser class={`text-local ${p.class}`} />
{/if}
