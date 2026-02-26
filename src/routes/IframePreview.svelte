<script lang="ts">
	import { supportsCredentiallessIframe } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-svelte';
	import CredentiallessIframe from './CredentiallessIframe.svelte';

	// TODO: detect when an embedded YouTube video finishes and play next vid
	// TODO: player controls in sidebar?
	// https://developers.google.com/youtube/iframe_api_reference

	let ytRegex =
		/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

	let p: { uri: string } = $props();
	let open = $state(false);
	let toggleBtn = $state<HTMLButtonElement>();
	let ytVideoId = $derived(p.uri.match(ytRegex)?.[1]);
	let ytVidStartTime = $derived(ytVideoId ? p.uri.match(/[?&](?:t|start)=([0-9]+)/)?.[1] : 0);
	let iframeDiv = $state<HTMLDivElement>();
	$effect(() => {
		open && iframeDiv?.scrollIntoView({ block: 'center' });
	});
</script>

{#snippet thumbnail()}
	<!-- TODO: make an iframe widget that renders img urls cuz img tags don't have a credentialless option -->
	<img
		class="-mb-2 -mt-1 max-h-42 bg-bg3 aspect-video object-cover"
		src={`https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`}
		alt={m.youTubeThumbnail()}
	/>
{/snippet}

{#if ytVideoId}
	{#if supportsCredentiallessIframe}
		<button
			bind:this={toggleBtn}
			class="h-6 w-6 bg-bg5 hover:bg-bg7 hover:text-fg3 xy inline-flex translate-y-1"
			onclick={() => (open = !open)}
			onkeydown={(e) => e.key === 'Escape' && (open = false)}
		>
			{#if open}
				<IconArrowsMinimize class="absolute h-5 w-5" />
			{:else}
				<IconArrowsMaximize class="absolute h-5 w-5" />
			{/if}
		</button>
		{#if !open}
			<br />
			<button
				class="-ml-1 mt-2"
				onclick={() => {
					open = true;
					toggleBtn?.focus();
				}}
			>
				{@render thumbnail()}
			</button>
		{/if}
		{#if open}
			<!-- TODO: add allow="autoplay" attribute and add ?autoplay=1 to url once you are able to focus the embedded player when it renders. That way keyboard shortcuts work without having to click pause and play first -->
			<!-- TODO: play next youtube video when the current one ends -->
			<div
				bind:this={iframeDiv}
				class="h-full max-h-[80vh] max-w-[calc(80vh*16/9)] aspect-video w-full"
			>
				<CredentiallessIframe
					allowfullscreen
					class="h-full w-full"
					src={`https://www.youtube.com/embed/${ytVideoId}?start=${ytVidStartTime}`}
					onkeydown={(e) => e.key === 'Escape' && (open = false)}
				/>
			</div>
		{/if}
	{:else}
		<br />
		<a href={p.uri} target="_blank" class="inline-block">
			{@render thumbnail()}
		</a>
	{/if}
{/if}
