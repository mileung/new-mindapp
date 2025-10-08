<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { IconX } from '@tabler/icons-svelte';

	let ytRegex =
		/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

	let p: { uri: string } = $props();
	let open = $state(false);
	let videoId = $derived(p.uri.match(ytRegex)?.[1]);
	let startTime = $derived(videoId ? p.uri.match(/[?&](?:t|start)=([0-9]+)/)?.[1] : 0);
	let iframe = $state<HTMLIFrameElement>();
	$effect(() => {
		if (open) {
			iframe?.scrollIntoView({ block: 'center' });
		}
	});
</script>

{#if videoId}
	{#if open}
		<button
			class="absolute h-6 w-6 bg-bg5 hover:bg-bg8 xy inline-flex ml-1"
			onclick={() => (open = false)}
		>
			<IconX class="absolute h-5 w-5" />
		</button>
	{:else}
		<button class="block" onclick={() => (open = true)}>
			<img
				class="h-42 bg-bg3 aspect-video object-cover"
				src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
				alt={m.youTubeThumbnail()}
			/></button
		>
	{/if}
	{#if open}
		<!-- TODO: add allow="autoplay" attribute and add ?autoplay=1 to url once you are able to focus the embedded player when it renders. That way keyboard shortcuts work without having to click pause and play first -->
		<!-- TODO: play next youtube video when the current one ends -->
		<!-- TODO: make a SafeIframe component to ignore this ts error -->
		<!-- @ts-ignore -->
		<iframe
			credentialless
			allowfullscreen
			bind:this={iframe}
			class="w-full max-h-[80vh] max-w-[calc(80vh*16/9)] aspect-video"
			src={`https://www.youtube.com/embed/${videoId}?start=${startTime}`}
			onkeydown={(e) => e.key === 'Escape' && (open = false)}
		></iframe>
	{/if}
{/if}
