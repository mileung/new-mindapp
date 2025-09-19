<script lang="ts">
	import { minidenticon } from 'minidenticons';

	let p: {
		data?: string;
		saturation?: number;
		lightness?: number;
		class?: string;
	} = $props();

	let svgURI = $derived(
		'data:image/svg+xml;utf8,' +
			encodeURIComponent(minidenticon(p.data || '', p.saturation || 100, p.lightness || 80)),
	);
</script>

<img src={svgURI} alt={`identicon`} {...p} />
