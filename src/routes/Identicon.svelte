<script lang="ts">
	import { minidenticon } from 'minidenticons';

	let p: {
		data?: string;
		class?: string;
	} = $props();

	let svgURI = $derived(
		'data:image/svg+xml;utf8,' + encodeURIComponent(minidenticon(p.data || '', 100, 80)),
	);
</script>

<img src={svgURI} alt={`identicon`} {...p} />
