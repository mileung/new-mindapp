<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { initLocalDb, localDbFilename } from '$lib/local-db';
	import { m } from '$lib/paraglide/messages';
	import { setTheme } from '$lib/theme';
	import { msToAccountNameTxt } from '$lib/types/accounts';
	import { getLocalCache, refreshSignedInAccounts, updateLocalCache } from '$lib/types/local-cache';
	import { getUrlInMs, hasTemplateIdRegex } from '$lib/types/parts/partIds';
	import {
		spaceMsToNameTxt,
		updateCurrentSpaceMembership,
		usePendingInvite,
	} from '$lib/types/spaces';
	import { IconChevronRight, IconX } from '@tabler/icons-svelte';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, untrack, type Snippet } from 'svelte';
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
		gs.currentSpaceMs = localCache.currentSpaceMs;
		refreshSignedInAccounts();

		if (!false) {
			try {
				await initLocalDb();
				let { driver, batchDriver } = new SQLocalDrizzle(localDbFilename);
				gs.db = drizzle(driver, batchDriver);
			} catch (error) {
				console.error(error);
				gs.localDbFailed = true;
				goto('/settings');
			}
		}

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

	let urlInMs = $derived(getUrlInMs());
	let lastHref = '';
	$effect(() => {
		if (gs.accounts && urlInMs === 8) {
			if (gs.accounts[0].ms) {
				let newHref =
					page.url.pathname.replace(
						hasTemplateIdRegex, //
						`__${gs.accounts[0].ms}`,
					) + page.url.search;
				if (newHref !== lastHref) {
					goto(newHref);
					gs.currentSpaceMs = gs.accounts[0].ms;
					lastHref = newHref;
				}
			}
		}
	});

	$effect(() => {
		if (urlInMs !== undefined && gs.currentSpaceMs !== urlInMs) {
			updateLocalCache((lc) => ({
				...lc,
				currentSpaceMs: urlInMs,
			}));
		}
	});
	let membership = $derived(
		gs.accountMsToSpaceMsToMembershipMap[gs.accounts?.[0].ms || 0]?.[gs.currentSpaceMs || 0],
	);
	$effect(() => {
		if (membership === undefined) {
			untrack(() => updateCurrentSpaceMembership());
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
					{msToAccountNameTxt(gs.pendingInvite!.by_ms, true)} invited you to {spaceMsToNameTxt(
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
