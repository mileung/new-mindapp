<script lang="ts">
	import Spinner from './Spinner.svelte';

	let p: { on?: boolean; class?: string; size?: number } = $props();
</script>

{#if p.on}
	<div class="bg-bg8/80 absolute xy inset-0">
		<Spinner {...p} class="w-8" />
	</div>
{/if}
