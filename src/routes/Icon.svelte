<script lang="ts">
	import { gs } from '$lib/globalState.svelte';
	import { type IconName } from '$lib/js';

	let {
		name,
		id,
		class: className = '',
	}: {
		name: IconName;
		id?: string;
		class?: string;
	} = $props();
</script>

<svg {id} viewBox="0 0 24 24" class={className}>
	{@html gs.iconsSlice[name]}
</svg>
