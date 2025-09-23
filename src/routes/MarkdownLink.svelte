<script lang="ts">
	let p: { href: string; title?: string } = $props();
</script>

<a href={p.href} title={p.title} target="_blank" rel="noopener noreferrer"><slot /></a>
