<script lang="ts">
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { getId } from '$lib/types/parts';

	let p: {
		id?: string;
		class?: string;
	} = $props();

	let urlId = $derived(page.state.modalId || page.params.id);
	let spotId = $derived(urlId && urlId[0] !== 'l' ? urlId : '');
	let [lineColor, overlayColor] = $derived.by(() => {
		if (!p.id) return ['bg-hl2', 'bg-hl2/5'];
		if ((gs.writingTo || gs.writingEdit) && getId(gs.writingTo || gs.writingEdit || {}) === p.id) {
			return gs.writingTo
				? ['bg-hl-link', 'bg-hl-link/5']
				: gs.writingEdit
					? ['bg-hl-edit', 'bg-hl-edit/5']
					: [];
		}
		if (spotId === p.id) return ['bg-hl-spot', 'bg-hl-spot/5'];
		return [];
	});
</script>

{#if lineColor && overlayColor}
	<div class={`z-50 absolute pointer-events-none inset-0 ${overlayColor} ${p.class}`}>
		<div class="w-0.5 h-full {lineColor}"></div>
	</div>
{/if}
