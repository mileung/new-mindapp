<script lang="ts">
	import { gs } from '$lib/globalState.svelte';
	import { setTheme } from '$lib/theme';
	import { initLocalDb } from '$lib/thoughts';
	import { IconBrowser, IconSettings } from '@tabler/icons-svelte';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, type Snippet } from 'svelte';
	import '../styles/app.css';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		gs.theme = (
			['light', 'dark', 'system'].includes(savedTheme!) ? (savedTheme as typeof gs.theme) : 'system'
		)!;

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

	$effect(() => gs.theme && setTheme(gs.theme));

	$effect(() => {
		if (gs.theme === 'system') {
			window
				?.matchMedia('(prefers-color-scheme: dark)')
				?.addEventListener?.('change', () => setTheme('system'));
		}
	});
	// let mouseHandlers = {
	// 	onmousedown: () => document.documentElement.classList.add('scrollbar-hidden'),
	// 	onclick: () => {
	// 		setTimeout(() => document.documentElement.classList.remove('scrollbar-hidden'), 1);
	// 	},
	// };
</script>

<div class="flex ml-12">
	<div class="bg-bg2 fixed left-0 w-12 h-screen flex flex-col gap-1.5 p-1.5">
		<!-- <a href="/search" class="xy aspect-square">
			<div class="h-full w-full xy rounded transition bg-bg8 hover:bg-bg6 text-fg1">
				<IconSearch class="h-full text-fg1" />
			</div>
		</a> -->
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
