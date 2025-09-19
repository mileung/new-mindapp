<script lang="ts">
	import { IconUserFilled } from '@tabler/icons-svelte';
	import Identicon from './Identicon.svelte';

	let p: {
		id?: null | number;
		class?: string;
	} = $props();
</script>

{#if typeof p.id === 'number'}
	<Identicon data={p.id + ''} class={p.class} />
{:else}
	<IconUserFilled class={p.class} />
{/if}
