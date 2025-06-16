<script lang="ts">
	import { IconPlayerPlay, IconX } from '@tabler/icons-svelte';

	const ytRegex =
		/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

	let p: { uri: string } = $props();

	let open = $state(false);
	let videoId = $derived(p.uri.match(ytRegex)?.[1]);
	let iframe = $state<HTMLIFrameElement>();
	// mini-scroll
	// $effect(() => {
	// 	open && iframe?.scrollIntoView();
	// });
</script>

{#if videoId}
	<!-- <img
		class="h-64 b object-contain cover"
		src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
		alt="YouTube Thumbnail"
	/> -->
	<button
		class="h-5 w-5 rounded bg-bg8 xy translate-y-0.5 inline-flex"
		onclick={() => (open = !open)}
	>
		{#if open}
			<IconX class="absolute h-5 w-5" />
		{:else}
			<IconPlayerPlay class="absolute h-4 w-4" />
		{/if}
	</button>
	{#if open}
		<!-- TODO: ignore this ts error -->
		<!-- @ts-ignore -->
		<iframe
			credentialless
			allowfullscreen
			bind:this={iframe}
			class="w-full max-h-[80vh] max-w-[calc(80vh*16/9)] aspect-video"
			src={`https://www.youtube.com/embed/${videoId}`}
		></iframe>
	{/if}
{/if}
