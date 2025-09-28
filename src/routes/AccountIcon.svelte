<script lang="ts">
	import { IconUserFilled } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		id: string;
		class?: string;
	} = $props();
</script>

{#if p.id === '__'}
	<IconUserFilled class={`text-fg1 ${p.class}`} />
{:else}
	<Identicon data={p.id} class={p.class} />
{/if}
