<script lang="ts">
	import { getYtVideoId } from '$lib/dom';
	import { supportsCredentiallessIframe } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-svelte';
	import CredentiallessIframe from './CredentiallessIframe.svelte';

	// TODO: detect when an embedded YouTube video finishes and play next vid
	// TODO: player controls in sidebar?
	// https://developers.google.com/youtube/iframe_api_reference

	let p: { url: string } = $props();
	let open = $state(false);
	// let open = $state(true);
	let toggleBtn = $state<HTMLButtonElement>();
	let iframeDiv = $state<HTMLDivElement>();

	let { imgSrc, iframeSrc, iframeType } = $derived.by(() => {
		let urlObj = new URL(p.url);
		let pathnameSlugs = urlObj.pathname.split('/').slice(1);
		let imgSrc = '';
		let iframeSrc = '';
		let iframeType: undefined | 'ig-post' | 'tt-vid' | 'x-post' | 'yt-vid';
		let tldToSldToScraperMap: Record<string, undefined | Record<string, undefined | (() => void)>> =
			{
				com: {
					instagram: () => {
						if (pathnameSlugs[0] === 'p') {
							iframeSrc = `https://www.instagram.com/p/${pathnameSlugs[1]}/embed/`;
							iframeType = 'ig-post';
						} else if (pathnameSlugs[0] === 'reels') {
							// iframeSrc = `https://www.instagram.com/p/${pathnameSlugs[1]}/embed/`;
							// iframeSrc = `https://www.instagram.com/reel/${pathnameSlugs[1]}/embed/`;
							// iframeSrc = `https://www.instagram.com/reels/${pathnameSlugs[1]}/embed/`;
							// console.log('iframeSrc:', iframeSrc);
						}
					},
					tiktok: () => {
						if (pathnameSlugs[1] === 'video') {
							iframeSrc = `https://www.tiktok.com/embed/v2/${pathnameSlugs[2]}`;
							iframeType = 'tt-vid';
						}
					},
					x: () => {
						if (pathnameSlugs[1] === 'status') {
							iframeSrc = `https://platform.twitter.com/embed/Tweet.html?id=${pathnameSlugs[2]}`;
							iframeType = 'x-post';
						}
					},
					youtube: () => {
						let ytVideoId = getYtVideoId(p.url);
						if (ytVideoId) {
							// TODO: add allow="autoplay" attribute and add ?autoplay=1 to url once you are able to focus the embedded player when it renders. That way keyboard shortcuts work without having to click pause and play first
							// TODO: play next youtube video when the current one ends
							let ytVidStartTime = p.url.match(/[?&](?:t|start)=([0-9]+)/)?.[1];
							imgSrc = `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`;
							iframeSrc = `https://www.youtube.com/embed/${ytVideoId}?start=${ytVidStartTime}`;
							iframeType = 'yt-vid';
						}
					},
				},
			};
		let [tld, sld] = urlObj.hostname.split('.', 3).reverse();
		tldToSldToScraperMap[tld]?.[sld]?.();
		return { imgSrc, iframeSrc, iframeType };
	});
</script>

{#snippet thumbnail(src: string)}
	<img
		crossorigin="anonymous"
		class="-mb-2 -mt-1 max-h-42 bg-bg3 aspect-video object-cover"
		{src}
		alt={m.youTubeThumbnail()}
	/>
{/snippet}

{#if imgSrc || iframeSrc}
	{#if supportsCredentiallessIframe}
		<button
			bind:this={toggleBtn}
			class="h-6 w-6 bg-bg5 hover:bg-bg7 hover:text-fg3 xy inline-flex translate-y-1"
			onclick={() => (open = !open)}
			onkeydown={(e) => {
				if (e.key === 'Escape' && open) {
					e.stopPropagation();
					open = false;
				}
			}}
		>
			{#if open}
				<IconArrowsMinimize class="absolute h-5 w-5" />
			{:else}
				<IconArrowsMaximize class="absolute h-5 w-5" />
			{/if}
		</button>
		{#if !open && imgSrc}
			<br />
			<button
				class="-ml-1 mt-2"
				onclick={() => {
					open = true;
					toggleBtn?.focus();
				}}
			>
				{@render thumbnail(imgSrc)}
			</button>
		{/if}
		{#if open && iframeType}
			<div
				bind:this={iframeDiv}
				class={`flex flex-col max-h-[80vh] ${
					(
						{
							'ig-post': 'aspect-[9/16]',
							'tt-vid': 'aspect-[9/16] max-w-80',
							'x-post': 'aspect-[5/8]',
							'yt-vid': 'aspect-video',
						} as Record<typeof iframeType, string>
					)[iframeType]
				}`}
			>
				<CredentiallessIframe allowfullscreen class="flex-1" src={iframeSrc} />
			</div>
		{/if}
	{:else if imgSrc}
		<a href={p.url} target="_blank" class="inline-block">
			{@render thumbnail(imgSrc)}
		</a>
	{/if}
{/if}
