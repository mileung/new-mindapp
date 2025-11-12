<script lang="ts">
	import type { HTMLIframeAttributes } from 'svelte/elements';

	let props: HTMLIframeAttributes = $props();
</script>

<!-- TODO: How to ignore this ts error -->
<iframe credentialless {...props}></iframe>
