<script lang="ts">
	import { gs } from '$lib/globalState.svelte';
	import { getSystemTheme, setTheme } from '$lib/theme';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, type Snippet } from 'svelte';
	import '../styles/app.css';
	import type { LayoutData } from './$types';
	import { IconBrowser, IconSettings } from '@tabler/icons-svelte';
	import { dropThoughtsTableInDev, initLocalDb } from '$lib/thoughts';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		gs.theme = (
			['light', 'dark'].includes(savedTheme!) ? (savedTheme as typeof gs.theme) : getSystemTheme()
		)!;
		setTheme(gs.theme);

		if ('serviceWorker' in navigator) {
			addEventListener('load', function () {
				// unregister service workers at chrome://serviceworker-internals
				navigator.serviceWorker.register('./service-worker.js');
			});
		}

		// dropThoughtsTableInDev();

		try {
			await initLocalDb();
			const { driver, batchDriver } = new SQLocalDrizzle('mindapp.db');
			gs.db = drizzle(driver, batchDriver);
		} catch (error) {
			console.log('error:', error);
		}
	});

	$effect(() => {
		if (gs.theme) {
			localStorage.setItem('theme', gs.theme);
			gs.theme.includes('dark')
				? document.documentElement.classList.add('dark')
				: document.documentElement.classList.remove('dark');
		}
	});
</script>

<div class="flex">
	<div class="bg-bg2 sticky top-0 bottom-0 h-screen w-12 flex flex-col gap-1.5 p-1.5">
		<a href="/" class="xy aspect-square">
			<div class="h-full w-full xy rounded transition bg-bg8 hover:bg-bg6 text-fg1">
				<IconBrowser class="h-full text-fg1" />
			</div>
		</a>
		<a href="/settings" class="xy aspect-square">
			<div class="h-full w-full xy rounded transition bg-bg8 hover:bg-bg6 text-fg1">
				<IconSettings class="h-full text-fg1" />
			</div>
		</a>
	</div>
	{@render children()}
</div>
