<script lang="ts">
	import { gs } from '$lib/globalState.svelte';
	import { getLocalCache } from '$lib/localCache';
	import { setTheme } from '$lib/theme';
	import { initLocalDb } from '$lib/thoughts';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, type Snippet } from 'svelte';
	import '../styles/app.css';
	import type { LayoutData } from './$types';
	import Sidebar from './Sidebar.svelte';
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

		// dropThoughtsTableInDev();

		try {
			await initLocalDb();
			const { driver, batchDriver } = new SQLocalDrizzle('mindapp.db');
			gs.db = drizzle(driver, batchDriver);
			// await deleteLocalCache()
			let localCache = await getLocalCache();
			gs.accounts = localCache.accounts;
			gs.spaces = localCache.spaces;
		} catch (error) {
			console.log('error:', error);
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

<Sidebar />
<div class="xs:ml-[var(--w-sidebar)]">
	{@render p.children()}
</div>
