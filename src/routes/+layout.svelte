<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { initLocalDb, localDbFilename } from '$lib/local-db';
	import { m } from '$lib/paraglide/messages';
	import { setTheme } from '$lib/theme';
	import { trpc } from '$lib/trpc/client';
	import { accountMsToName } from '$lib/types/accounts';
	import { getLocalCache, refreshCurrentAccount, updateLocalCache } from '$lib/types/local-cache';
	import { getWhoWhereObj } from '$lib/types/parts';
	import { getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import { spaceMsToName, usePendingInvite } from '$lib/types/spaces';
	import { IconChevronRight, IconX } from '@tabler/icons-svelte';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, type Snippet } from 'svelte';
	import '../styles/app.css';
	import type { LayoutData } from './$types';
	import AccountIcon from './AccountIcon.svelte';
	import Sidebar from './Sidebar.svelte';
	let p: { data: LayoutData; children: Snippet } = $props();

	onMount(async () => {
		let theme = localStorage.getItem('theme') as typeof gs.theme;
		gs.theme = (['light', 'dark', 'system'].includes(theme!) ? theme : 'system')!;
		setTheme(gs.theme);

		let localCache = getLocalCache();
		gs.accounts = localCache.accounts;
		gs.msToSpaceMap = localCache.msToSpaceMap;
		gs.currentSpaceMs = localCache.currentSpaceMs;

		try {
			await initLocalDb();
			let { driver, batchDriver } = new SQLocalDrizzle(localDbFilename);
			gs.db = drizzle(driver, batchDriver);
		} catch (error) {
			console.error(error);
			gs.localDbFailed = true;
			goto('/settings');
		}

		let oldSignedInAccountMss = gs.accounts.filter((a) => a.signedIn).map((a) => a.ms);
		if (oldSignedInAccountMss.length) {
			let res = await trpc().checkSignedInAccountMss.mutate({
				...(await getWhoWhereObj()),
				accountMss: oldSignedInAccountMss,
			});
			updateLocalCache((lc) => ({
				...lc,
				accounts: lc.accounts.map((a) => ({
					...a,
					signedIn: res.signedInAccountMss.includes(a.ms),
				})),
			}));
			refreshCurrentAccount();
		}
		updateLocalCache((lc) => ({
			...lc,
			accounts: lc.accounts.sort((a, b) => {
				if (a.signedIn && b.signedIn) return 0;
				if (a.signedIn && !b.signedIn) return -1;
				if (!a.signedIn && b.signedIn) return 1;
				return a.ms - b.ms;
			}),
		}));

		if ('serviceWorker' in navigator) {
			window.addEventListener('load', () => {
				// unregister service workers at chrome://serviceworker-internals
				navigator.serviceWorker.register('./service-worker.js');
			});
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
				updateLocalCache((lc) => ({
					...lc,
					currentSpaceMs: in_ms,
				}));
		}
	});

	let joinSpaceButtonClass = $derived(
		`fx h-9 pl-2 font-semibold ${page.url.pathname === '/sign-in' || page.url.pathname === '/create-account' ? 'text-fg2' : 'text-black bg-hl1 hover:bg-hl2'}`,
	);
</script>

<Sidebar />
<div class={`xs:pl-[var(--w-sidebar)] pb-9 xs:pb-0`}>
	{#if !!gs.pendingInvite}
		<div class={`z-50 overflow-x-scroll text-nowrap sticky top-0 h-9 fx justify-between bg-bg3`}>
			<div class="fx">
				<AccountIcon isSystem ms={gs.pendingInvite!.by_ms} class="w-6 ml-0.5 mr-2" />
				<p class="font-bold">
					{accountMsToName(gs.pendingInvite!.by_ms, true)} invited you to {spaceMsToName(
						gs.pendingInvite!.in_ms,
					)}
				</p>
				<button
					class="xy h-9 w-9 text-fg2 hover:bg-bg4 hover:text-fg1"
					onclick={() => (gs.pendingInvite = undefined)}
				>
					<IconX stroke={2.5} class="h-5" />
				</button>
			</div>
			{#if gs.accounts?.[0].ms}
				<button onclick={usePendingInvite} class={joinSpaceButtonClass}>
					{m.joinSpace()}
					<IconChevronRight class="h-5" stroke={3} />
				</button>
			{:else}
				<a href="/sign-in" class={joinSpaceButtonClass}>
					{m.signInAndJoin()}
					<IconChevronRight class="h-5" stroke={3} />
				</a>
			{/if}
		</div>
	{/if}
	{@render p.children()}
</div>
