<script lang="ts">
	import { IconBrowser, IconUser, IconWorld } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		id: string;
		class?: string;
	} = $props();
</script>

{#if p.id === '__'}
	<IconBrowser class={`text-local ${p.class}`} />
{:else if p.id === '__1'}
	<IconWorld class={`text-global ${p.class}`} />
{:else if p.id === '__0'}
	<IconUser class={`text-personal ${p.class}`} />
{:else}
	<Identicon data={p.id} class={p.class} />
{/if}
