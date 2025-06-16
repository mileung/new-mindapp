<script lang="ts">
	import { formatMs } from '$lib/time';
	let p: { thoughtId: string } = $props();
</script>

<a
	target="_blank"
	href={`/${p.thoughtId}`}
	class="px-1 my-1 w-fit block border-2 border-bg3 rounded text-sm font-bold transition text-fg2 hover:text-fg1 hover:border-bg6"
>
	{formatMs(+p.thoughtId.substring(0, p.thoughtId.indexOf('_')))}
</a>
