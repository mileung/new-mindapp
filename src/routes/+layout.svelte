<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { scrape } from '$lib/dom';
	import { gs } from '$lib/global-state.svelte';
	import { initLocalDb } from '$lib/local-db';
	import { setTheme } from '$lib/theme';
	import { trpc } from '$lib/trpc/client';
	import {
		refreshCurrentAccount,
		getLocalCache,
		updateLocalCache,
		changeCurrentSpace,
	} from '$lib/types/local-cache';
	import { splitId } from '$lib/types/parts';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, type Snippet } from 'svelte';
	import '../styles/app.css';
	import type { LayoutData } from './$types';
	import Sidebar from './Sidebar.svelte';
	import { strIsInt } from '$lib/js';
	let p: { data: LayoutData; children: Snippet } = $props();

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		gs.theme = (
			['light', 'dark', 'system'].includes(savedTheme!) ? (savedTheme as typeof gs.theme) : 'system'
		)!;
		let localCache = getLocalCache();
		gs.accounts = localCache.accounts;
		gs.spaces = localCache.spaces;
		gs.currentSpaceMs = localCache.currentSpaceMs;

		if (page.url.pathname === '/') {
			let currentSpaceMsStr = localStorage.getItem('currentSpaceMs');
			goto(`/l_l_${strIsInt(currentSpaceMsStr || '') ? currentSpaceMsStr : ''}`, {
				replaceState: true,
			});
		}

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

					gs.writingNew = true;
					gs.writerTags = scrapedInfo.tags || [];
					// TODO: think of a better ux. Like when a user highlights and runs the mindapp shortcut, what should be prepopulated in the writer?
					// TODO: convert selection to md. Include links, images, video, iframes, other stuff if possible
					gs.writerBody = `${scrapedInfo.headline}\n${scrapedInfo.url}\n\n${selectedPlainText}`;
				}
			});
		}

		if ('serviceWorker' in navigator) {
			window.addEventListener('load', function () {
				// unregister service workers at chrome://serviceworker-internals
				navigator.serviceWorker.register('./service-worker.js');
			});
		}

		// dropNodesTableInOpfsInDev();

		try {
			await initLocalDb();
			const { driver, batchDriver } = new SQLocalDrizzle('mindapp.db');
			gs.db = drizzle(driver, batchDriver);

			try {
				if (page.params.id) {
					let { in_ms } = splitId(page.params.id);
					if (in_ms !== gs.currentSpaceMs) {
						if (page.params.id.startsWith('l_l_')) {
							changeCurrentSpace(in_ms);
						} else if (!gs.accounts[0].spaceMss.includes(in_ms)) {
							// If you visit the url for thought in a space you are not in, this should change the current space to local and maybe it'll be there locally saved
							changeCurrentSpace(null, true);
							// TODO: Show the option to join the space
						}
					}
				}

				try {
					// TODO: show accounts that were signed but but need to be signed in again for some reason?
					let signedInMss = await trpc().auth.getSignedInMss.mutate({
						accountMss: gs.accounts.map((a) => a.ms).filter((n) => n !== null),
					});
					let signedInMsSet = new Set(signedInMss);
					updateLocalCache((lc) => {
						lc.accounts = lc.accounts.filter((a) => a.ms === null || signedInMsSet.has(a.ms));
						return lc;
					});
					refreshCurrentAccount();
				} catch (error) {
					console.log('error:', error);
					alert(error);
				}
			} catch (error) {
				console.log('error:', error);
				alert(error);
				gs.localDbFailed = true;
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
</script>

<!-- TODO: scroll feed even when on sidebar. Do not use multiple Sidebar instances.  -->
<Sidebar />
<div class="xs:pl-[var(--w-sidebar)] min-h-screen pt-9 xs:pt-0">
	{@render p.children()}
</div>
