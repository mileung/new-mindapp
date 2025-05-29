<script lang="ts">
	import { onMount } from 'svelte';
	import '../styles/app.css';
	import { getSystemTheme, setTheme } from '$lib/theme';
	import { gs } from '$lib/globalState.svelte';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { thoughtsTable } from '$lib';
	import { dev } from '$app/environment';

	let { children } = $props();

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

		try {
			if (dev) {
				// await sql`DROP TABLE "thoughts";`;
			}
			await sql`
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
			let thoughts = await gs.db.select().from(thoughtsTable).orderBy(thoughtsTable.ms).all();
			console.log('thoughts:', thoughts);
			gs.feeds[''] = thoughts;
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

{@render children()}
