<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { scrape } from '$lib/dom';
	import { gs } from '$lib/global-state.svelte';
	import { getLocalCache } from '$lib/types/local-cache';
	import { setTheme } from '$lib/theme';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
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

		if (page.url.pathname === '/') {
			goto(`/__${localStorage.getItem('currentSpaceMs') || ''}`, {
				replaceState: true,
			});
		}

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
			try {
				let localCache = await getLocalCache();
				// console.log('localCache:', localCache);
				gs.accounts = localCache.accounts;
				gs.spaces = localCache.spaces;
			} catch (error) {
				console.log('error:', error);
				alert(error);
				if (error === 'Invalid localCache') {
					gs.invalidLocalCache = true;
				} else {
					gs.localDbFailed = true;
				}
				goto('/settings');
			}
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

	$effect(() => {
		if (page.url.searchParams.get('extension') !== null) {
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
					let scrapedInfo = scrape(url, externalDomString);

					gs.writerMode = 'new';
					gs.writerTags = scrapedInfo.tags || [];
					// TODO: think of a better ux. Like when a user highlights and runs the mindapp shortcut, what should be prepopulated in the writer?
					// TODO: convert selection to md. Include links, images, video, iframes, other stuff if possible
					gs.writerBody = `${scrapedInfo.headline}\n${scrapedInfo.url}\n\n${selectedPlainText}`;
				}
			});
		}
	});
</script>

<!-- TODO: scroll feed even when on sidebar. Do not use multiple Sidebar instances.  -->
<Sidebar />
<div class="xs:pl-[var(--w-sidebar)] min-h-screen pt-9 xs:pt-0">
	{@render p.children()}
</div>
