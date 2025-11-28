<script lang="ts">
	import IframePreview from './IframePreview.svelte';

	let p: {
		text: string;
	} = $props();

	// const assetRegex = /!\[([^\]]*)\]\(([^\)]*)\)/g;
	// const linkRegex = /\[([^\]]*)\]\(([^\)]*)\)/g;
	const uriRegex = /([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(\S+)/g;
	// const assetMatches = text.matchAll(assetRegex);
	// const linkMatches = text.matchAll(linkRegex);
	const uriMatches = $derived(p.text.matchAll(uriRegex));

	type A = { text: string; uri: string };
	type Img = { alt: string; imageUri: string };
	type Video = { alt: string; videoUri: string };
	type Audio = { alt: string; audioUri: string };
	const result: (string | A | Img | Video | Audio)[] = $derived.by(() => {
		let start = 0;
		let result = [];
		for (const match of uriMatches) {
			result.push(p.text.substring(start, match.index), { text: match[0], uri: match[0] });
			start = match.index! + match[0].length;
		}
		if (start < p.text.length) {
			result.push(p.text.substring(start));
		}
		return result;
	});
</script>

<p class="whitespace-pre-wrap font-medium break-words">
	{#each result as tag}
		{#if typeof tag === 'string'}
			{tag}
		{:else if 'uri' in tag}
			<a
				target="_blank"
				href={tag.uri}
				class="text-fg1 hover:text-fg3 underline decoration-hl1 hover:decoration-hl2"
			>
				{tag.text}
			</a>
			<IframePreview uri={tag.uri} />
		{/if}
	{/each}
</p>
