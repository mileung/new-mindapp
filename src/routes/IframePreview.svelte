<script lang="ts">
	import { page } from '$app/state';
	import { getYtVideoId } from '$lib/dom';
	import { isTouchScreen, supportsCredentiallessIframe } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-svelte';
	import type { LayoutServerData } from './$types';
	import CredentiallessIframe from './CredentiallessIframe.svelte';

	// TODO: detect when an embedded YouTube video finishes and play next vid
	// TODO: player controls in sidebar?
	// https://developers.google.com/youtube/iframe_api_reference

	let p: { url: string } = $props();
	let toggleBtn = $state<HTMLButtonElement>();
	let { imgSrc, iframeSrc, iframeType } = $derived.by(() => {
		if (!supportsCredentiallessIframe && (page.data as LayoutServerData).sqlocalOk) return {};

		if (/\.(jpg|jpeg|png|webp|avif|gif|svg)(\?.*)?$/i.test(p.url)) return { imgSrc: p.url };
		let urlObj = new URL(p.url);
		let pathnameSlugs = urlObj.pathname.split('/').slice(1);
		let imgSrc = '';
		let iframeSrc = '';
		let iframeType: undefined | 'ig-post' | 'sc' | 'tt-vid' | 'x-post' | 'yt-vid';
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
					soundcloud: () => {
						if (pathnameSlugs.length === 2) {
							iframeType = 'sc';
							let params = {
								// color: 'ff5500',
								// auto_play: false,
								// hide_related: false,
								// show_comments: true,
								// show_user: true,
								// show_reposts: false,
								// show_teaser: true,
								// visual: true,
							};
							let query = new URLSearchParams({
								url: p.url,
								...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
							});
							iframeSrc = `https://w.soundcloud.com/player/?${query.toString()}`;
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
	let open = $state((() => (iframeSrc ? !imgSrc : false))());
</script>

{#snippet thumbnail(src: string)}
	<img
		crossorigin="anonymous"
		class="-mb-2 -mt-1 h-42 bg-bg3 aspect-video object-cover"
		{src}
		alt={m.thumbnail()}
	/>
{/snippet}

{#if imgSrc || iframeSrc}
	{#if iframeSrc}
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
		{#if open && iframeType}
			<div
				class={`flex flex-col mr-8 max-h-[64vh] ${
					// TODO: getting this css right is hard
					(
						{
							// 'ig-post': 'aspect-[9/16]',
							// 'tt-vid': 'aspect-[9/16] max-w-80',
							// 'x-post': 'w-[80vw] h-[calc(8/5*80vw)] xs:h-auto xs:w-auto xs:aspect-[5/8]',
							'yt-vid': 'aspect-video',
							sc: 'max-w-[80vw]',
						} as Record<typeof iframeType, string>
					)[iframeType] || (isTouchScreen ? 'h-80' : 'aspect-[3/4]')
				}`}
			>
				{#if supportsCredentiallessIframe}
					<CredentiallessIframe allowfullscreen class="flex-1" src={iframeSrc} />
				{:else}
					<iframe allowfullscreen class="flex-1" src={iframeSrc}></iframe>
				{/if}
			</div>
		{/if}
	{/if}
	{#if imgSrc}
		{#if open}
			{#if !iframeSrc}
				<button class="block" onclick={() => (open = false)}>
					<img
						crossorigin="anonymous"
						class="min-h-42 max-h-[80vh] bg-bg3 object-contain"
						src={imgSrc}
						alt={m.thumbnail()}
					/>
				</button>
			{/if}
			<!-- {:else if !supportsCredentiallessIframe && iframeSrc}
			<a href={p.url} target="_blank" class="block w-fit">
				{@render thumbnail(imgSrc)}
			</a> -->
		{:else}
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
	{/if}
{/if}
