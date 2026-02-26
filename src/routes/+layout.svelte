<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { initLocalDb, localDbFilename } from '$lib/local-db';
	import { m } from '$lib/paraglide/messages';
	import { setTheme } from '$lib/theme';
	import { trpc } from '$lib/trpc/client';
	import {
		accountMsToNameTxt,
		type GetCallerContextGetArg,
		type MyAccountUpdates,
		type SpaceContext,
	} from '$lib/types/accounts';
	import { getLocalCache, updateLocalCache } from '$lib/types/local-cache';
	import { getIdStrAsIdObj, isIdStr, isSpaceSlug } from '$lib/types/parts/partIds';
	import {
		permissionCodes,
		roleCodes,
		spaceMsToNameTxt,
		usePendingInvite,
	} from '$lib/types/spaces';
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
		gs.urlInMs = localCache.urlInMs;

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

	let lastHref = '';
	$effect(() => {
		if (gs.accounts?.[0].ms && page.url.pathname.includes('_8')) {
			let newHref = page.url.pathname.replace('_8', `_${gs.accounts[0].ms}`) + page.url.search;
			if (newHref !== lastHref) {
				goto(newHref);
				lastHref = newHref;
			}
		}
	});

	let urlInMs = $derived.by(() => {
		let slug = page.url.pathname.split('/')[1];
		if (isSpaceSlug(slug)) return +slug.slice(2);
		if (isIdStr(slug)) return getIdStrAsIdObj(slug).in_ms;
	});
	$effect(() => {
		if (urlInMs !== undefined && gs.urlInMs !== urlInMs)
			updateLocalCache((lc) => ({ ...lc, urlInMs }));
	});

	$effect(() => {
		if (
			gs.accounts !== undefined &&
			gs.urlInMs !== undefined &&
			gs.urlInMs === urlInMs &&
			!gs.accountMsToSpaceMsToCheckedMap[gs.accounts[0].ms]?.[gs.urlInMs]
		) {
			(async () => {
				let spaceMs = gs.urlInMs;
				if (gs.accounts === undefined || spaceMs === undefined) return;
				let callerMs = gs.accounts?.[0].ms;

				let firstTimeChecking = !Object.keys(gs.accountMsToSpaceMsToCheckedMap).length;
				let oldSignedInAccountMss = gs.accounts.filter((a) => a.signedIn).map((a) => a.ms);

				let signedIn: undefined | boolean;

				let signedInAccountMss: undefined | number[];
				let currentAccountUpdates: undefined | MyAccountUpdates;
				let spaceContext: undefined | SpaceContext;

				if (!spaceMs || callerMs === spaceMs) {
					spaceContext = {
						isPublic: { num: 0 },
						roleCode: { num: roleCodes.owner },
						permissionCode: { num: permissionCodes.reactAndPost },
					};
				} else if (spaceMs === 1 && !callerMs) {
					spaceContext = { isPublic: { num: 1 } };
				}

				let oldSpaceContext = gs.accounts[0].spaceMsToContextMap[spaceMs];

				let get: GetCallerContextGetArg = {
					...(spaceContext
						? {}
						: {
								isPublic: oldSpaceContext?.isPublic || true,
								pinnedQuery: oldSpaceContext?.pinnedQuery || true,
								roleCode: callerMs ? oldSpaceContext?.roleCode || true : false,
								permissionCode: callerMs ? oldSpaceContext?.permissionCode || true : false,
							}),
					// spaceMssAwaitingResponse:
					// yourTurnIndicatorsFromSpaceMsToLastCheckMsMap: gs.accounts[0].spaceMss,
					...(!callerMs || gs.accountMsToSpaceMsToCheckedMap[callerMs]
						? {}
						: {
								latestAccountAttributesFromCallerAttributes: {
									email: gs.accounts[0].email,
									name: gs.accounts[0].name,
									bio: gs.accounts[0].bio,
									savedTags: gs.accounts[0].savedTags,
									spaceMss: gs.accounts[0].spaceMss,
								},
							}),
					...(firstTimeChecking && oldSignedInAccountMss.length
						? {
								signedInAccountMssFrom: oldSignedInAccountMss, //
							}
						: {}),
				};

				console.log('get:', get);
				if (Object.values(get).some((v) => !!v)) {
					try {
						get.signedIn = !!callerMs;
						let res = await trpc().getCallerContext.query({
							callerMs,
							spaceMs,
							get,
						});
						console.log('getCallerContext res:', res);
						signedIn = res.signedIn;
						signedInAccountMss = res.signedInAccountMss;
						if (res.signedIn) {
							currentAccountUpdates = res.currentAccountUpdates;
							spaceContext = spaceContext || {
								isPublic:
									res.isPublic === null
										? null //
										: res.isPublic || oldSpaceContext!.isPublic,
								pinnedQuery:
									res.pinnedQuery === null
										? null //
										: res.pinnedQuery || oldSpaceContext!.pinnedQuery,
								roleCode:
									res.roleCode === null
										? null //
										: res.roleCode || oldSpaceContext!.roleCode,
								permissionCode:
									res.permissionCode === null
										? null
										: res.permissionCode || oldSpaceContext!.permissionCode,
							};
							// spaceMssAwaitingResponse: res.spaceMssAwaitingResponse,
						} else {
							signedInAccountMss = (signedInAccountMss || oldSignedInAccountMss).filter(
								(ms) => ms !== callerMs,
							);
						}
					} catch (error) {
						console.log('error:', error);
					}
				}

				// if (!callerMs || signedIn)
				gs.accountMsToSpaceMsToCheckedMap = {
					...gs.accountMsToSpaceMsToCheckedMap,
					[callerMs]: {
						...gs.accountMsToSpaceMsToCheckedMap[callerMs],
						[spaceMs]: true,
					},
				};

				updateLocalCache((lc) => {
					if (spaceContext) {
						lc.accounts[0] = {
							...lc.accounts[0],
							spaceMsToContextMap: {
								...lc.accounts[0].spaceMsToContextMap,
								[spaceMs]: spaceContext,
							},
						};
					}
					if (currentAccountUpdates) {
						lc.accounts[0] = {
							...lc.accounts[0],
							...currentAccountUpdates,
						};
					}
					if (signedInAccountMss) {
						lc.accounts = lc.accounts
							.map((a) => ({
								...a,
								signedIn: signedInAccountMss.includes(a.ms),
							}))
							.sort((a, b) => {
								let aPriority = !a.ms || a.signedIn ? 0 : 1;
								let bPriority = !b.ms || b.signedIn ? 0 : 1;
								return aPriority - bPriority;
							});
					}
					return lc;
				});
				gs.accountMsToNameTxtMap = {
					...gs.accountMsToNameTxtMap,
					...gs.accounts.reduce(
						(obj, account) => ({
							...obj, //
							[account.ms]: account.name.txt,
						}),
						{},
					),
				};
			})();
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
					{accountMsToNameTxt(gs.pendingInvite!.by_ms, true)} invited you to {spaceMsToNameTxt(
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
