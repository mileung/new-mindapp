<script lang="ts">
	import { gs } from '$lib/globalState.svelte';
	import { getSystemTheme, setTheme } from '$lib/theme';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, type Snippet } from 'svelte';
	import '../styles/app.css';
	import type { LayoutData } from './$types';
	import { dev } from '$app/environment';
	import { dropThoughtsTableInDev } from '$lib/thoughts';
	import { IconBrowser, IconSettings } from '@tabler/icons-svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		gs.theme = (
			['light', 'dark'].includes(savedTheme!) ? (savedTheme as typeof gs.theme) : getSystemTheme()
		)!;
		setTheme(gs.theme);

		if ('serviceWorker' in navigator) {
			addEventListener('load', function () {
				// unregister service workers at
				// chrome://serviceworker-internals
				navigator.serviceWorker.register('./service-worker.js');
			});
		}

		const { sql, driver, batchDriver } = new SQLocalDrizzle('mindapp.db');

		// if (dev) {
		// 	console.warn(
		// 		'Dropping thoughts table in development mode. This should NEVER run in production!',
		// 	);
		// 	dropThoughtsTableInDev(sql);
		// }

		try {
			await sql`
				PRAGMA journal_mode=WAL;
				CREATE TABLE IF NOT EXISTS thoughts (
					by_id TEXT,
					ms INTEGER NOT NULL,
					to_id TEXT,
					body TEXT,
					tags TEXT, -- storing JSON as TEXT
					PRIMARY KEY (by_id, ms)
				);
				CREATE INDEX IF NOT EXISTS by_id_idx ON thoughts(by_id);
				CREATE INDEX IF NOT EXISTS ms_idx ON thoughts(ms);
				CREATE INDEX IF NOT EXISTS to_id_idx ON thoughts(to_id);
				CREATE INDEX IF NOT EXISTS body_idx ON thoughts(body);
				CREATE INDEX IF NOT EXISTS tags_idx ON thoughts(tags);
			`;

			gs.db = drizzle(driver, batchDriver);
		} catch (error) {
			console.log('error:', error);
		}

		// const { getDatabaseFile } = new SQLocalDrizzle('mindapp.db');
		// const databaseFile = await getDatabaseFile();
		// console.log('databaseFile:', databaseFile);
	});

	$effect(() => {
		localStorage.setItem('theme', gs.theme);
		gs.theme.includes('dark')
			? document.documentElement.classList.add('dark')
			: document.documentElement.classList.remove('dark');
	});
</script>

<div class="flex">
	<div class="bg-bg2 sticky top-0 bottom-0 h-screen w-12 flex flex-col gap-1.5 p-1.5">
		<a href="/" class="xy aspect-square">
			<div class="rounded xy bg-bg8 h-full w-full p-1">
				<IconBrowser class="h-full text-fg1" />
			</div>
		</a>
		<a href="/settings" class="xy aspect-square">
			<div class="rounded xy bg-bg8 h-full w-full p-1">
				<IconSettings class="h-full text-fg1" />
			</div>
		</a>
	</div>
	{@render children()}
</div>
