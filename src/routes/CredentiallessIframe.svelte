<script lang="ts">
	import type { HTMLIframeAttributes } from 'svelte/elements';

	let p: HTMLIframeAttributes = $props();
</script>

<!-- TODO: How to ignore this ts error -->
<iframe credentialless {...p}></iframe>
