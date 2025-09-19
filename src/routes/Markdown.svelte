<script lang="ts">
	import { gs } from '$lib/globalState.svelte';
	import { type IconName } from '$lib/js';
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

{#each result as tag}
	{#if typeof tag === 'string'}
		{#if tag}
			<p class="whitespace-pre-wrap break-words inline font-medium">{tag}</p>
		{/if}
	{:else if 'uri' in tag}
		<a
			target="_blank"
			href={tag.uri}
			class="font-medium inline break-all text-hl1 text hover:text-hl2"
		>
			{tag.text}
		</a>
		<IframePreview uri={tag.uri} />
	{/if}
{/each}
