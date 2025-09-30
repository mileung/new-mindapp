<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { scrape } from '$lib/dom';
	import { gs } from '$lib/global-state.svelte';
	import { getLocalCache } from '$lib/local-cache';
	import { setTheme } from '$lib/theme';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import html2md from 'html-to-md';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, type Snippet } from 'svelte';
	import '../styles/app.css';
	import type { LayoutData } from './$types';
	import Sidebar from './Sidebar.svelte';
	import { initLocalDb } from '$lib/local-db';
	let p: { data: LayoutData; children: Snippet } = $props();
	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		gs.theme = (
			['light', 'dark', 'system'].includes(savedTheme!) ? (savedTheme as typeof gs.theme) : 'system'
		)!;

		if ('serviceWorker' in navigator) {
			window.addEventListener('load', function () {
				// unregister service workers at chrome://serviceworker-internals
				navigator.serviceWorker.register('./service-worker.js');
			});
		}

		// dropThoughtsTableInOpfsInDev();

		try {
			await initLocalDb();
			const { driver, batchDriver } = new SQLocalDrizzle('mindapp.db');
			gs.db = drizzle(driver, batchDriver);
			// await deleteLocalCache()
			let localCache = await getLocalCache();
			// console.log('localCache:', localCache);
			gs.accounts = localCache.accounts;
			gs.spaces = localCache.spaces;
		} catch (error) {
			console.log('error:', error);
			gs.localDbFailed = true;
			goto('/settings');
		}
	});

	$effect(() => gs.theme && setTheme(gs.theme));
	$effect(() => {
		if (gs.theme === 'system') {
			window
				?.matchMedia('(prefers-color-scheme: dark)')
				?.addEventListener?.('change', () => setTheme('system'));
		}
	});

	function goToCurrentSpace() {
		gs.accounts[0] &&
			goto(`/__${gs.accounts[0].currentSpaceMs}`, {
				replaceState: true,
				keepFocus: true,
			});
	}
	$effect(() => {
		page.url.pathname === '/' && goToCurrentSpace();
	});
	$effect(() => {
		if (page.url.searchParams.get('extension') !== null) {
			goToCurrentSpace();
			window.postMessage({ type: '2-popup-requests-external-page-info' }, '*');
			window.addEventListener('message', (event) => {
				if (event.source !== window) return;
				if (event.data.type === '4-popup-receives-external-page-info') {
					let { url, externalDomString, selectedPlainText, selectedHtmlString } =
						(event.data.payload as {
							url?: string;
							externalDomString?: string;
							selectedPlainText?: string;
							selectedHtmlString?: string;
						}) || {};
					if (!url || !externalDomString) return;
					let scrapedInfo = selectedHtmlString
						? {
								headline: (() => {
									if (!0) {
										return selectedPlainText;
									}
									console.log('selectedHtmlString:', selectedHtmlString);
									let fragment = new DOMParser().parseFromString(selectedHtmlString, 'text/html');
									fragment.querySelectorAll('a[href]').forEach((a) => {
										a.setAttribute('href', new URL(a.getAttribute('href') || '/', url).href);
									});
									console.log('fragment:', fragment.body.innerHTML);

									// return fragment.body.textContent;
									let markdown = html2md(fragment.body.innerHTML.replace(/\n/g, '<br/>'), {
										skipTags: ['font'],
										renderCustomTags: 'SKIP',
									});
									// console.log('markdown:', markdown);
									return markdown;
								})(),
								tags: [],
								url,
							}
						: scrape(url, externalDomString);

					gs.writerTags = scrapedInfo?.tags || [];
					gs.writerBody = `${scrapedInfo?.headline}\n${scrapedInfo?.url || url}\n\n`;
				}
			});
		}
	});
</script>

<Sidebar />
<div class="xs:pl-[var(--w-sidebar)] min-h-screen pt-9 xs:pt-0">
	{@render p.children()}
</div>
