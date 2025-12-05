<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { initLocalDb, localDbFilename } from '$lib/local-db';
	import { setTheme } from '$lib/theme';
	import { trpc } from '$lib/trpc/client';
	import { getLocalCache, refreshCurrentAccount, updateLocalCache } from '$lib/types/local-cache';
	import { getBaseInput } from '$lib/types/parts';
	import { getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, type Snippet } from 'svelte';
	import '../styles/app.css';
	import type { LayoutData, LayoutServerData } from './$types';
	import Sidebar from './Sidebar.svelte';
	let p: { data: LayoutData; children: Snippet } = $props();

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		gs.theme = (
			['light', 'dark', 'system'].includes(savedTheme!) ? (savedTheme as typeof gs.theme) : 'system'
		)!;
		setTheme(gs.theme);
		let localCache = getLocalCache();
		gs.accounts = localCache.accounts;
		gs.idToSpaceMap = localCache.spaces;
		gs.currentSpaceMs = localCache.currentSpaceMs;

		if ('serviceWorker' in navigator) {
			window.addEventListener('load', function () {
				// unregister service workers at chrome://serviceworker-internals
				navigator.serviceWorker.register('./service-worker.js');
			});
		}

		try {
			await initLocalDb();
			const { driver, batchDriver } = new SQLocalDrizzle(localDbFilename);
			gs.db = drizzle(driver, batchDriver);

			try {
				if (page.params.id) {
					let { in_ms } = getIdStrAsIdObj(page.params.id);
					if (in_ms >= 0 && in_ms !== gs.currentSpaceMs) {
						if (page.params.id.startsWith('__')) {
							goto(`/__${in_ms}`);
						} else if (!gs.accounts[0].spaceMss.includes(in_ms)) {
							// If you visit the url for thought in a space you are not in, this should change the current space to local and maybe it'll be there locally saved
							goto(`/__0`);
							// TODO: Show the option to join the space
						}
					}
				}

				try {
					// TODO: show accounts that were signed but but need to be signed in again for some reason?
					let accountMss = gs.accounts.map((a) => a.ms).filter((n) => n !== null);
					if (accountMss.length && (page.data as LayoutServerData).sessionIdExists) {
						let signedInMss = await trpc().auth.verifySignedInMss.mutate({
							...(await getBaseInput()),
							accountMss,
						});
						let signedInMsSet = new Set(signedInMss);
						updateLocalCache((lc) => {
							lc.accounts = lc.accounts.filter((a) => a.ms === 0 || signedInMsSet.has(a.ms));
							return lc;
						});
						refreshCurrentAccount();
					}
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
	$effect(() => {
		if (gs.theme === 'system') {
			window?.matchMedia('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
				gs.theme = 'dark'; // retriggers moreOpaque in Highlight.svelte
				setTheme('system');
			});
		}
	});
	$effect(() => {
		if (page.params.id) {
			let { in_ms } = getIdStrAsIdObj(page.params.id);
			gs.currentSpaceMs !== in_ms &&
				updateLocalCache((lc) => {
					lc.currentSpaceMs = in_ms;
					return lc;
				});
		}
	});
</script>

<!-- TODO: scroll feed even when on sidebar. Do not use multiple Sidebar instances.  -->
<Sidebar />
<div class={`xs:pl-[var(--w-sidebar)] min-h-screen ${page.params.id ? '' : 'pb-9 xs:pb-0'}`}>
	{@render p.children()}
</div>
