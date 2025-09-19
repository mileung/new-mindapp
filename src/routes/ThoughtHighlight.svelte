<script lang="ts">
	let p: {
		id: string;
		spotId?: string;
		toId?: string;
		editId?: string;
		class?: string;
	} = $props();
	let [lineColor, overlayColor] = $derived.by(() => {
		return p.toId === p.id
			? ['bg-hl-link', 'bg-hl-link/5']
			: p.editId === p.id
				? ['bg-hl-edit', 'bg-hl-edit/5']
				: p.spotId === p.id
					? ['bg-hl-spot', 'bg-hl-spot/5']
					: [];
	});
</script>

{#if lineColor && overlayColor}
	<div class={`z-50 absolute pointer-events-none inset-0 ${overlayColor} ${p.class}`}>
		<div class="w-0.5 h-full {lineColor}"></div>
	</div>
{/if}
