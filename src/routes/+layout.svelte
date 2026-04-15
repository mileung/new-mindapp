<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getUrlInMsContext, gs, msToSpaceNameTxt } from '$lib/global-state.svelte';
	import { alertError, splitUntil } from '$lib/js';
	import { initLocalDb, localDbFilename } from '$lib/local-db';
	import { m } from '$lib/paraglide/messages';
	import { setTheme } from '$lib/theme';
	import {
		type CallerContext,
		type GetCallerContextGetArg,
		type MyAccountUpdates,
	} from '$lib/types/accounts';
	import { getLocalCache, updateLocalCache } from '$lib/types/local-cache';
	import { getUrlInMs } from '$lib/types/parts/partIds';
	import {
		getDefaultSpace,
		type MySpaceUpdate,
		type MySpaceUpdateFrom,
		type SpaceContext,
	} from '$lib/types/spaces';
	import { drizzle } from 'drizzle-orm/sqlite-proxy';
	import { SQLocalDrizzle } from 'sqlocal/drizzle';
	import { onMount, type Snippet } from 'svelte';
	import '../styles/app.css';
	import type { LayoutData, LayoutServerData } from './$types';
	import Sidebar from './Sidebar.svelte';
	let p: { data: LayoutData; children: Snippet } = $props();

	let isEmbed = $derived(page.url.pathname.startsWith('/embed'));
	onMount(async () => {
		if (isEmbed) return;
		let theme = localStorage.getItem('mindappTheme') as typeof gs.theme;
		gs.theme = (['light', 'dark', 'system'].includes(theme!) ? theme : 'system')!;
		setTheme(gs.theme);
		let localCache = getLocalCache();
		gs.accounts = localCache.accounts;
		gs.lastSeenInMs = localCache.lastSeenInMs;
		gs.msToSpaceMap = localCache.msToSpaceMap;

		try {
			await initLocalDb();
			let { driver, batchDriver } = new SQLocalDrizzle(localDbFilename);
			gs.db = drizzle(driver, batchDriver);
		} catch (error) {
			console.error(error);
			gs.localDbFailed = true;
			goto('/settings');
		}

		'serviceWorker' in navigator &&
			window.addEventListener('load', () => {
				// unregister service workers at chrome://serviceworker-internals
				navigator.serviceWorker.register('./service-worker.js');
			});
	});

	$effect(() => {
		if (gs.theme !== 'system') return;
		let mql = window.matchMedia('(prefers-color-scheme: dark)');
		let handler = () => {
			gs.theme = 'dark'; // retriggers moreOpaque in Highlight.svelte
			setTheme('system');
		};
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	});

	let lastHref = '';
	$effect(() => {
		let [, firstSlug, ending] = splitUntil(page.url.pathname, '/', 2);
		if (gs.accounts?.[0].ms && firstSlug.endsWith('_8')) {
			let newHref =
				`/${firstSlug.slice(0, -1)}${gs.accounts[0].ms}${ending ? `/${ending}` : ''}` +
				page.url.search;
			if (newHref !== lastHref) {
				goto(newHref);
				lastHref = newHref;
			}
		}
	});

	let urlInMs = $derived(getUrlInMs());
	$effect(() => {
		urlInMs !== undefined &&
			gs.lastSeenInMs !== urlInMs &&
			updateLocalCache((lc) => ({ ...lc, lastSeenInMs: urlInMs }));
	});

	$effect(() => {
		try {
			(async () => {
				let checkedAnythingBefore = !!Object.keys(gs.accountMsToSpaceMsToCheckedMap).length;
				if (
					gs.accounts !== undefined &&
					gs.lastSeenInMs !== undefined &&
					(urlInMs === undefined
						? !checkedAnythingBefore
						: !gs.accountMsToSpaceMsToCheckedMap[gs.accounts[0].ms]?.[urlInMs])
				) {
					let spaceDne = urlInMs !== undefined && urlInMs > 1 && urlInMs < 1775000111222;
					let caller = gs.accounts[0];
					let callerMs = caller.ms;

					if (urlInMs === 8 && callerMs) return;

					let checkedThisAccountBefore = !!gs.accountMsToSpaceMsToCheckedMap[callerMs];
					let checkedSpaceWithThisAccountBefore =
						urlInMs !== undefined &&
						!!Object.keys(gs.accountMsToSpaceMsToCheckedMap[callerMs]?.[urlInMs] || {}).length;

					let currentSpaceUpdateFrom: undefined | MySpaceUpdateFrom =
						urlInMs === undefined
							? undefined
							: {
									ms: urlInMs,
									isPublic: gs.msToSpaceMap[urlInMs]?.isPublic || { num: 0 },
									pinnedQuery: gs.msToSpaceMap[urlInMs]?.pinnedQuery || { txt: '' },
									name:
										gs.msToSpaceMap[urlInMs]?.name || (urlInMs > 1 && urlInMs !== callerMs)
											? { txt: '' }
											: undefined,
									...(() => {
										let spaceContext = getUrlInMsContext();
										return {
											accentCode: spaceContext?.accentCode || { num: 0 },
											roleCode: spaceContext?.roleCode || { num: 0 },
											permissionCode: spaceContext?.permissionCode || { num: 0 },
										};
									})(),
								};
					let currentSpaceUpdateFromArr = currentSpaceUpdateFrom ? [currentSpaceUpdateFrom] : [];
					let get: GetCallerContextGetArg = {
						allJoinedSpaces: !checkedThisAccountBefore,
						spaceUpdatesFrom: checkedSpaceWithThisAccountBefore
							? undefined
							: checkedThisAccountBefore
								? currentSpaceUpdateFromArr
								: [
										...caller.joinedSpaceContexts
											.map((spaceCtx) => {
												let space = gs.msToSpaceMap[spaceCtx.ms];
												return (
													space?.ms && {
														ms: spaceCtx.ms,
														name: space.ms > 1 && space.ms !== callerMs ? space.name : undefined,
														accentCode:
															space.ms && space.ms !== callerMs ? spaceCtx.accentCode : undefined,
														...(spaceCtx.ms === urlInMs
															? {
																	isPublic: space.isPublic,
																	pinnedQuery: space.pinnedQuery,
																	roleCode: spaceCtx.roleCode,
																	permissionCode: spaceCtx.permissionCode,
																}
															: {}),
													}
												);
											})
											.filter((s) => !!s),
										...(caller.joinedSpaceContexts.some((sc) => sc.ms === urlInMs)
											? []
											: currentSpaceUpdateFromArr),
									],
						signedInAccountUpdatesFrom: checkedThisAccountBefore
							? undefined //
							: checkedAnythingBefore
								? [
										{
											ms: callerMs,
											email: caller.email,
											bio: caller.bio,
											savedTags: caller.savedTags,
										},
									]
								: gs.accounts
										.filter((a) => a.ms)
										.map((a) => ({
											ms: a.ms,
											name: a.name,
											email: callerMs === a.ms ? a.email : undefined,
											bio: callerMs === a.ms ? a.bio : undefined,
											savedTags: callerMs === a.ms ? a.savedTags : undefined,
										})),
					};

					// console.log('get', JSON.stringify(get, null, 2));
					let callerContext: CallerContext;
					// try {
					// 	callerContext = await trpc().getCallerContext.query({
					// 		callerMs,
					// 		spaceMs: urlInMs,
					// 		get,
					// 	});
					// } catch (error) {
					// 	console.log('error:', error);
					// 	callerContext = {
					// 		joinedSpaceUpdates: [], //
					// 		signedInAccountUpdates: [],
					// 	};
					// }
					callerContext = {
						joinedSpaceUpdates: [], //
						signedInAccountUpdates: [],
					};
					// console.log('callerContext', JSON.stringify(callerContext, null, 2));

					gs.accountMsToSpaceMsToCheckedMap = {
						...gs.accountMsToSpaceMsToCheckedMap,
						[callerMs]: {
							...gs.accountMsToSpaceMsToCheckedMap[callerMs],
							...(urlInMs === undefined ? {} : { [urlInMs]: true }),
						},
					};
					updateLocalCache((lc) => {
						[...callerContext.joinedSpaceUpdates, callerContext.visitingPublicSpaceUpdate].forEach(
							(spaceUpdate) => {
								if (spaceUpdate) {
									lc.msToSpaceMap[spaceUpdate.ms] ||= {
										...getDefaultSpace(), //
										ms: spaceUpdate.ms,
									};
									let space = lc.msToSpaceMap[spaceUpdate.ms]!;
									space.isPublic = spaceUpdate.isPublic || space.isPublic;
									space.name = spaceUpdate.name || space.name;
									space.pinnedQuery = spaceUpdate.pinnedQuery || space.pinnedQuery;
								}
							},
						);

						let msToSignedInAccountUpdateMap: Record<number, MyAccountUpdates> = {};
						for (let i = 0; i < callerContext.signedInAccountUpdates.length; i++) {
							let u = callerContext.signedInAccountUpdates[i];
							msToSignedInAccountUpdateMap[u.ms] = u;
						}
						lc.accounts = lc.accounts.map((a) => {
							let accountUpdate = msToSignedInAccountUpdateMap[a.ms];
							if (!checkedAnythingBefore) a.signedIn = !!accountUpdate;
							a.email = accountUpdate?.email || a.email;
							a.name = accountUpdate?.name || a.name;
							a.bio = accountUpdate?.bio || a.bio;
							a.savedTags = accountUpdate?.savedTags || a.savedTags;
							return a;
						});

						if (lc.accounts[0].signedIn) {
							let msToJoinedSpaceUpdateMap: Record<number, MySpaceUpdate> = {};
							for (let i = 0; i < callerContext.joinedSpaceUpdates.length; i++) {
								let u = callerContext.joinedSpaceUpdates[i];
								msToJoinedSpaceUpdateMap[u.ms] = u;
							}
							let newJoinedSpaceContexts: SpaceContext[] = callerContext.joinedSpaceUpdates
								.filter(
									(spaceUpdate) =>
										spaceUpdate?.roleCode &&
										!lc.accounts[0].joinedSpaceContexts.some((sc) => sc.ms === spaceUpdate?.ms),
								)
								.map(
									(su) =>
										({
											ms: su!.ms,
											accentCode: su!.accentCode || { num: 0 },
											permissionCode: su!.permissionCode || { num: 0 },
											roleCode: su!.roleCode || { num: 0 },
										}) satisfies SpaceContext,
								);
							// console.log(
							// 	'msToJoinedSpaceUpdateMap:',
							// 	get.allJoinedSpaces,
							// 	msToJoinedSpaceUpdateMap,
							// );
							lc.accounts[0] = {
								...lc.accounts[0],
								joinedSpaceContexts: [
									...lc.accounts[0].joinedSpaceContexts,
									...newJoinedSpaceContexts,
								]
									.filter(({ ms }) => !get.allJoinedSpaces || msToJoinedSpaceUpdateMap[ms])
									.map((sc) => {
										let spaceUpdate = msToJoinedSpaceUpdateMap[sc.ms];
										return {
											ms: sc.ms,
											accentCode: spaceUpdate?.accentCode || sc.accentCode,
											permissionCode: spaceUpdate?.permissionCode || sc.permissionCode,
											roleCode: spaceUpdate?.roleCode || sc.roleCode,
										};
									})
									.sort((a, b) => (b.accentCode.ms || 0) - (a.accentCode.ms || 0)),
							};
						}

						Object.values(lc.msToSpaceMap).forEach((space) => {
							if (
								space &&
								space.ms > 1 &&
								!lc.accounts.some(
									(a) => a.signedIn && a.joinedSpaceContexts.some((c) => c.ms === space.ms),
								)
							)
								delete lc.msToSpaceMap[space.ms];
						});

						lc.accounts.sort((a, b) => {
							let aPriority = !a.ms || a.signedIn ? 0 : 1;
							let bPriority = !b.ms || b.signedIn ? 0 : 1;
							return aPriority - bPriority;
						});
						return lc;
					});

					// gs.msToProfileMap = {
					// 	...gs.msToProfileMap,
					// 	...gs.accounts.reduce(
					// 		(obj, account) => ({
					// 			...obj, //
					// 			[account.ms]: account satisfies PublicProfile,
					// 		}),
					// 		{},
					// 	),
					// };
				}
			})();
		} catch (error) {
			// console.log('error:', error);
			alertError(error);
		}
	});

	let pageData = $derived(page.data as LayoutServerData);
	$effect(() => {
		// console.log('test:', pageData);
	});

	let searchVal = $state((() => page.url.searchParams.get('q') || '')());
	let title = $derived.by(() => {
		if (urlInMs !== undefined) {
			return msToSpaceNameTxt(urlInMs);
		}
		return (
			{
				'/create-space': m.createSpace(),
				'/user-guide': m.userGuide(),
				'/settings': m.settings(),
				'/sign-in': m.signIn(),
				'/create-account': m.createAccount(),
				'/reset-password': m.resetPassword(),
			} as Record<string, string>
		)[page.url.pathname];
	});
	let appendedTitle = $derived.by(() => {
		return `${title ? `${title} | ` : ''}Mindapp`;
	});
	let siteDescription = $derived('General purpose organizer');
	let thinTopOgText = $derived(
		pageData.thinTopOgText || page.url.href.slice(page.url.origin.length),
	);
	let boldBottomOgText = $derived(pageData.boldBottomOgText || title);
</script>

<title>{appendedTitle}</title>
<meta name="description" content={siteDescription} />
<meta property="og:description" content={thinTopOgText} />
<meta property="og:title" content={boldBottomOgText} />
<!-- this og:url is needed to get ios to properly render the og text -->
<meta property="og:url" content="https://x.com/_/status/0" />

{#if !isEmbed}
	<Sidebar />
{/if}
<div class={isEmbed ? '' : `xs:pl-[var(--w-sidebar)] pb-9 xs:pb-0`}>
	{@render p.children()}
</div>
