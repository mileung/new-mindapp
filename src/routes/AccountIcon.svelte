<script lang="ts">
	import { IconUserFilled } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		id: string;
		class?: string;
	} = $props();
</script>

{#if p.id}
	<Identicon data={p.id} class={p.class} />
{:else}
	<IconUserFilled class={`text-fg1 ${p.class}`} />
{/if}
