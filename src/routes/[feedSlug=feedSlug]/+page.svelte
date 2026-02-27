<script lang="ts">
	import { page } from '$app/state';
	import { scrollToHighlight, textInputFocused } from '$lib/dom';
	import { getBottomOverlayShown, gs, resetBottomOverlay } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { hasParent } from '$lib/types/parts';
	import {
		getAtIdStr,
		getIdStr,
		getIdStrAsIdObj,
		id0,
		isIdStr,
		type IdObj,
	} from '$lib/types/parts/partIds';
	import { getLastVersion, normalizeTags, type Post } from '$lib/types/posts';
	import { addPost } from '$lib/types/posts/addPost';
	import { editPost } from '$lib/types/posts/editPost';
	import { getPostFeed, postsPerLoad, type GetPostFeedArg } from '$lib/types/posts/getPostFeed';
	import { parseSearchQuery } from '$lib/types/posts/parseSearchQuery';
	import { getPromptSigningIn, permissionCodes } from '$lib/types/spaces';
	import {
		IconArchive,
		IconChevronRight,
		IconClockUp,
		IconEye,
		IconInbox,
		IconLibrary,
		IconList,
		IconListSearch,
		IconListTree,
		IconMessage2,
		IconMessage2Up,
		IconPencilPlus,
		IconPinned,
		IconSquareFilled,
		IconStack2,
		IconX,
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import PostBlock from '../PostBlock.svelte';
	import PostWriter from '../PostWriter.svelte';
	import PromptSignIn from '../PromptSignIn.svelte';
	import ReactionHistory from '../ReactionHistory.svelte';

	let p: {
		pathname: string;
		search: string;
	} = $props();

	let pinnedQueryTxtId = '';

	let { searchParams } = $derived(page.url);
	let qSearchParam = $derived(searchParams.get('q') || '');
	let view = $derived<'flat' | 'nested'>(searchParams.get('flat') !== null ? 'flat' : 'nested');
	let nested = $derived(view === 'nested');
	let sortedBy = $derived<'bumped' | 'new' | 'old'>(
		searchParams.get('new') !== null
			? 'new'
			: searchParams.get('old') !== null
				? 'old'
				: qSearchParam
					? 'new'
					: 'bumped',
	);

	let postIdStr = $derived.by(() => {
		let { feedSlug } = page.params;
		return isIdStr(feedSlug) ? feedSlug : undefined;
	});
	let spaceContext = $derived(gs.accounts?.[0].spaceMsToContextMap[gs.urlInMs || 0]);
	let canView = $derived(spaceContext?.isPublic || spaceContext?.roleCode);
	let showViewOnly = $derived(canView && !spaceContext?.permissionCode);
	let showYourTurn = $derived(
		gs.urlInMs && gs.urlInMs !== gs.accounts?.[0].ms && spaceContext?.permissionCode,
	);
	let promptSignIn = $derived(getPromptSigningIn());
	let allowTopLvlPosting = $derived(
		!postIdStr &&
			!promptSignIn &&
			(spaceContext?.permissionCode?.num === permissionCodes.postOnly ||
				spaceContext?.permissionCode?.num === permissionCodes.reactAndPost),
	);

	let identifier = $derived(
		JSON.stringify({
			canView,
			ms: gs.accounts?.[0].ms,
			href: page.url.href,
		}),
	);
	let feed = $derived(gs.urlToFeedMap[identifier]);
	let topLvlPostIdStrs = $derived(feed?.topLvlPostIdStrs || []);
	let endReached = $derived(feed?.endReached);
	let postAtBumpedPostIdObjsExclude = $derived(feed?.postAtBumpedPostIdObjsExclude || []);
	let error = $derived(feed?.error || '');
	let loadMorePosts = async (e: InfiniteEvent) => {
		if (!spaceContext || promptSignIn) return;

		// await new Promise((res) => setTimeout(res, 1000));
		// TODO: load locally saved topLvlPostIdStrs and only fetch new ones if the user scrolls or interacts with the feed. This is to reduce unnecessary requests when the user just wants to add a post via the extension
		if (endReached) return e.detail.complete();

		// console.log('loadMorePosts');

		// TODO: Instead of set theory, implement option to save searches
		let test = parseSearchQuery(qSearchParam);

		let lastTopLvlPostIdStr = topLvlPostIdStrs.slice(-1)[0];
		let lastTopLvlPostIdObj = lastTopLvlPostIdStr ? getIdStrAsIdObj(lastTopLvlPostIdStr) : null;
		let postFeed: Awaited<ReturnType<typeof getPostFeed>>;
		let getPostFeedArg: GetPostFeedArg = {
			view,
			sortedBy,
			postAtBumpedPostIdObjsExclude,
			msBefore: undefined,
			msAfter: undefined,
			byMssExclude: [],
			byMssInclude: [],
			inMssExclude: [],
			inMssInclude: gs.urlInMs ? [gs.urlInMs] : [],
			postIdObjsExclude: [],
			postIdObjsInclude: [],
			tagsExclude: [],
			tagsInclude: [],
			coreExcludes: [],
			coreIncludes: [],
		};

		try {
			if (postIdStr) {
				if (lastTopLvlPostIdObj?.ms) getPostFeedArg.msBefore = lastTopLvlPostIdObj.ms + 1;
				postFeed = await getPostFeed({
					...getPostFeedArg,
					postIdObjsInclude: [getIdStrAsIdObj(postIdStr)],
				});
			} else {
				if (lastTopLvlPostIdObj) {
					if (sortedBy === 'bumped') {
						let lastPostAtBumpedPostIdObjsExclude = postAtBumpedPostIdObjsExclude.slice(-1)[0];
						if (lastPostAtBumpedPostIdObjsExclude) {
							getPostFeedArg.msBefore = lastPostAtBumpedPostIdObjsExclude.ms + 1;
						}
					} else {
						if (sortedBy === 'new') {
							getPostFeedArg.msBefore = lastTopLvlPostIdObj.ms + 1;
						} else if (sortedBy === 'old') {
							getPostFeedArg.msAfter = lastTopLvlPostIdObj.ms - 1;
						}
						let lastTopLvlPostIdObjsWithSameMs: IdObj[] = [lastTopLvlPostIdObj];
						for (let i = topLvlPostIdStrs.length - 1; i >= 0; i--) {
							let idObj = getIdStrAsIdObj((topLvlPostIdStrs as string[])[i]);
							if (idObj.ms === lastTopLvlPostIdObj!.ms) {
								lastTopLvlPostIdObjsWithSameMs.push(idObj);
							} else break;
						}
						getPostFeedArg.postIdObjsExclude = [...lastTopLvlPostIdObjsWithSameMs];
					}
				}
				postFeed = await getPostFeed(getPostFeedArg);
			}
			let { topLvlPostIdStrs: newTopLvlPostIdStrs, idToPostMap: newIdToPostMap } = postFeed;
			// TODO: add accountMsToNameTxtMap to local db
			// TODO: add msToSpaceNameTxtMap to local db
			gs.accountMsToNameTxtMap = {
				...gs.accountMsToNameTxtMap,
				...postFeed.msToAccountNameTxtMap,
			};

			// console.log(
			// 	'postFeed.spaceMsToAccountMsToRoleNumMap:',
			// 	postFeed.spaceMsToAccountMsToRoleNumMap,
			// );
			for (let key in postFeed.spaceMsToAccountMsToRoleNumMap) {
				gs.spaceMsToAccountMsToRoleNumMap[key] ||= {};
				for (let prop in postFeed.spaceMsToAccountMsToRoleNumMap[key]) {
					gs.spaceMsToAccountMsToRoleNumMap[key][prop] =
						postFeed.spaceMsToAccountMsToRoleNumMap[key][prop];
				}
			}

			Object.entries(newIdToPostMap).forEach(([id, post]) => {
				let lastVersion = getLastVersion(newIdToPostMap[id]);
				if (newIdToPostMap[id].history?.[lastVersion]) {
					(newIdToPostMap[id].history[lastVersion].tags ??= []).sort();
				}
				if (hasParent(post)) {
					let strAtId = getAtIdStr(post);
					if (!gs.idToPostMap[strAtId]) gs.idToPostMap[strAtId] = { ...id0, history: {} };
					gs.idToPostMap[strAtId].subIds = [
						...new Set([...(gs.idToPostMap[strAtId]?.subIds || []), id]),
					];
					gs.idToPostMap[strAtId].subIds.sort(
						(a, b) => getIdStrAsIdObj(b).ms - getIdStrAsIdObj(a).ms,
					);
				}
				gs.idToPostMap[id] = { ...gs.idToPostMap[id], ...newIdToPostMap[id] };
			});

			newTopLvlPostIdStrs.length && e.detail.loaded();
			let endReached = newTopLvlPostIdStrs.length < postsPerLoad;
			endReached && e.detail.complete();
			gs.urlToFeedMap = {
				...gs.urlToFeedMap,
				[identifier]: {
					endReached,
					topLvlPostIdStrs: [...new Set([...topLvlPostIdStrs, ...newTopLvlPostIdStrs])],
					postAtBumpedPostIdObjsExclude: postFeed.postAtBumpedPostIdObjsExclude,
				},
			};
		} catch (error) {
			gs.urlToFeedMap = {
				...gs.urlToFeedMap,
				[identifier]: {
					// @ts-ignore
					error: String(error?.message || m.placeholderError()),
				},
			};
			e.detail.error();
		}
	};

	let viewPostToastId = $state('');
	let submitPost = async (tags: string[], core: string) => {
		if (!gs.accounts) return;
		await updateSavedTags(tags);
		let post: Post;
		if (gs.writingEdit) {
			let postBeingEdited = gs.idToPostMap[getIdStr(gs.writingEdit)]!;
			let newLastVersion = getLastVersion(postBeingEdited)! + 1;
			post = {
				...postBeingEdited,
				history: {
					...postBeingEdited.history,
					[newLastVersion]: {
						ms: 0,
						tags,
						core,
					},
				},
			};
			// let updateInCloud = async () => {
			// 	post.tags = await editPost(post, true);
			// 	await overwriteLocalPost(post);
			// };
			// if (!inMs) {
			// 	Number.isInteger(post.in_ms) ? updateInCloud() : (post.tags = await editPost(post, false));
			// } else updateInCloud();
			post.history![newLastVersion]!.ms = (await editPost(post)).ms;
		} else {
			post = {
				...id0,
				...(gs.writingTo
					? {
							at_ms: gs.writingTo.ms,
							at_by_ms: gs.writingTo.by_ms,
							at_in_ms: gs.writingTo.in_ms,
						}
					: {}),
				by_ms: gs.accounts[0].ms,
				in_ms: gs.urlInMs!,
				history: {
					1: {
						ms: 0,
						tags: normalizeTags(tags),
						core,
					},
				},
			};
			try {
				// TODO: fetch cited posts if not already in feed
				post.ms = (await addPost(post)).ms;
				post.history![1]!.ms = post.ms;
				post.subIds = [];
				gs.urlInMs && (await addPost(post, true));
			} catch (error) {
				console.error(error);
				return alert(error);
			}
		}

		let strPostId = getIdStr(post);
		gs.idToPostMap = { ...gs.idToPostMap, [strPostId]: post };
		if (gs.writingTo) {
			let atPostId = getAtIdStr(post);
			gs.idToPostMap[atPostId!]!.subIds = gs.idToPostMap[atPostId!]!.subIds || [];
			nested && gs.idToPostMap[atPostId!]!.subIds!.unshift(strPostId);
		}
		if (gs.writingNew && (sortedBy === 'bumped' || sortedBy === 'new')) {
			topLvlPostIdStrs = [strPostId, ...topLvlPostIdStrs];
		}
		if (gs.writingNew || gs.writingTo) {
			viewPostToastId = strPostId;
			setTimeout(() => (viewPostToastId = ''), 3000);
		}
		// TODO add new posts to all feeds applicable (cited, bumped, new, etc.)
		resetBottomOverlay();
	};

	let makeParams = (newView: 'nested' | 'flat', newSortedBy: 'bumped' | 'new' | 'old') => {
		let v = newView === 'nested' ? '' : newView;
		let s =
			newSortedBy === 'bumped' || //
			(qSearchParam && newSortedBy === 'new')
				? ''
				: newSortedBy;
		let queryParams = `?${v}${v && s ? '&' : ''}${s}`;
		return queryParams === '?' ? page.url.pathname : queryParams;
	};
	// TODO: when clicking to a page with the feed already cached, it takes noticeably longer to render presumably cuz it's rendering the whole feed. Get rid of this delay without taking away the ability to command-f the whole page. Scroll height mustn't change so to maintain same scroll position when switching between space and post feeds.
	let postObjFeed = $derived(
		topLvlPostIdStrs.map((strPostId) => gs.idToPostMap[strPostId || 0]).filter((t) => !!t),
	);

	let scrolledToSpotId = $state(false);
	$effect(() => {
		// if (postIdStr && !scrolledToSpotId && postObjFeed?.length) {
		if (postIdStr && !scrolledToSpotId) {
			setTimeout(() => scrollToHighlight(postIdStr!), 0);
		}
	});

	let endingPanelClass = $derived(
		gs.pendingInvite
			? `h-[calc(100vh-36px-36px)] xs:h-[calc(100vh-36px)]`
			: 'h-[calc(100vh-36px)]  xs:h-screen',
	);

	onMount(() => {
		let handler = (e: KeyboardEvent) => {
			if (!textInputFocused()) {
				// TODO: press b to sort feed by bumped
				// TODO: press n to sort feed by new
				// TODO: press o to sort feed by old
				// TODO: press f to sort feed by first

				// TODO: press r to reply to current highlighted or hovered post
				// TODO: press e to edit to current highlighted or hovered post
				// TODO: press c to cite current highlighted or hovered post

				// TODO: press left/right to highlight next adjacent post
				// TODO: press shift left/right to highlight next depth 0 post
				if (allowTopLvlPosting && e.key === 'n') {
					e.preventDefault();
					resetBottomOverlay();
					gs.writingNew = true;
				}
			}
		};
		window.addEventListener('keydown', handler);
		return () => {
			resetBottomOverlay();
			window.removeEventListener('keydown', handler);
		};
	});
</script>

<div
	class={`z-50 flex flex-col ${gs.pendingInvite ? 'h- screen-[calc(100vh-36px)]' : 'h- screen'}`}
>
	{#if gs.urlInMs === undefined}
		<!--  -->
	{:else if promptSignIn}
		<PromptSignIn />
	{:else}
		{#if qSearchParam}
			<div class="h-9 fx">
				<IconListSearch class="shrink-0 w-6 ml-0.5 mr-2" />
				<!-- <p class="font-bold text-xl">{m.search()}</p> -->
				<p class="font-bold text-xl truncate">{qSearchParam}</p>
			</div>
		{:else if postIdStr}
			<div class="h-9 fx">
				<IconMessage2 class="shrink-0 w-6 ml-0.5 mr-2" />
				<p class="font-bold text-xl">{m.post()}</p>
			</div>
		{:else if showViewOnly}
			<div class="h-9 fx">
				<IconEye class="shrink-0 w-6 ml-0.5 mr-2" />
				<p class="font-bold text-xl">{m.viewOnly()}</p>
			</div>
		{:else if showYourTurn}
			<div class="h-9 fx">
				<IconInbox class="shrink-0 w-6 ml-0.5 mr-2" />
				<p class="font-bold text-xl">{m.yourTurn()}</p>
			</div>
			{#if gs.accounts}
				{#if gs.accounts[0].ms}
					<p class="ml-1.5 text-fg2">{m.noPostsAwaitingYourResponse()}</p>
				{:else}
					<p class="ml-1.5">
						{@html m.signInToSeePostsAwaitingYourResponse()}
					</p>
				{/if}
			{/if}
			{#if pinnedQueryTxtId}
				<div class="mt-2 fx">
					<IconPinned class="shrink-0 w-6 ml-0.5 mr-2" />
					<p class="font-bold text-xl leading-4">{m.pinned()}</p>
				</div>
			{/if}
			<div class="mt-2 fx">
				<IconStack2 class="shrink-0 w-6 ml-0.5 mr-2" />
				<p class="font-bold text-xl leading-4">{m.nextUp()}</p>
			</div>
		{/if}
		<div
			class={`flex w-full text-fg2 overflow-scroll shrink-0 ${showYourTurn ? 'h-8' : 'h-9'} ${postIdStr ? 'hidden' : ''}`}
		>
			<a
				href={makeParams('nested', sortedBy)}
				class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${view === 'nested' ? 'text-fg1' : ''}`}
			>
				<IconListTree stroke={2.5} class="h-4" />{m.nested()}
			</a>
			<a
				href={makeParams('flat', sortedBy)}
				class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${view === 'flat' ? 'text-fg1' : ''}`}
			>
				<IconList stroke={2.5} class="h-4" />{m.flat()}
			</a>
			<div class="xy mr-0.5">
				<IconSquareFilled class="h-1.5 w-1.5" />
			</div>
			{#if !qSearchParam}
				<a
					href={makeParams(view, 'bumped')}
					class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${sortedBy === 'bumped' ? 'text-fg1' : ''}`}
				>
					<IconMessage2Up stroke={2.5} class="h-4" />
					{m.bumped()}
				</a>
			{/if}
			<a
				href={makeParams(view, 'new')}
				class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${sortedBy === 'new' ? 'text-fg1' : ''}`}
			>
				<IconClockUp stroke={2.5} class="h-4" />{m.new()}
			</a>
			<a
				href={makeParams(view, 'old')}
				class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${sortedBy === 'old' ? 'text-fg1' : ''}`}
			>
				<IconArchive stroke={2.5} class="h-4" />{m.old()}
			</a>
		</div>
		{#each postObjFeed as post, i (getIdStr(post))}
			{#if postIdStr && i === 1}
				<div class="h-9 fx">
					<IconLibrary class="shrink-0 w-6 ml-0.5 mr-2" />
					<p class="font-bold text-xl">{m.citedIn()}</p>
				</div>
			{/if}
			<PostBlock {...p} {post} depth={0} nested={postIdStr ? !i : nested} />
		{/each}
		{#if canView}
			<InfiniteLoading {identifier} spinner="spiral" on:infinite={loadMorePosts}>
				<div slot="noResults" class={endingPanelClass}>
					<p class="m-2 text-lg text-fg2">
						<!-- noResults slot shows even after adding the first post -->
						{postObjFeed?.length ? m.theEnd() : m.noPostsFound()}
					</p>
				</div>
				<div slot="noMore" class={endingPanelClass}>
					<p class="m-2 text-lg text-fg2">{m.theEnd()}</p>
				</div>
				<p slot="error" class="m-2 text-lg text-fg2">
					{error}
				</p>
			</InfiniteLoading>
		{:else}
			<p class="m-2 text-lg text-fg2 text-center">
				{m.spaceNotFound()}
			</p>
		{/if}
	{/if}
	{#if postIdStr}
		<a
			href={`/__${gs.urlInMs}`}
			onclick={() => {
				gs.lastScrollY && setTimeout(() => window.scrollTo({ top: gs.lastScrollY }), 1);
			}}
			class="z-50 fixed xy right-0 bottom-9 xs:bottom-0 h-9 w-9 bg-bg5 border-b-2 border-hl1 hover:bg-bg7 hover:text-fg3 hover:border-hl2"
		>
			<IconX class="w-8" />
		</a>
	{:else if allowTopLvlPosting}
		<button
			class="z-40 fixed xy right-0 bottom-9 xs:bottom-0 h-8 w-8 xs:h-9 xs:w-9 text-bg1 bg-fg1 hover:bg-fg3 border-b-2 border-hl1 hover:border-hl2"
			onclick={() => (gs.writingNew = true)}
		>
			<IconPencilPlus class="h-8 xs:h-9" />
		</button>
	{/if}
	<div class="flex-1"></div>
	<div
		class={`fixed bottom-0 z-50 left-0 xs:left-[var(--w-sidebar)] right-0 h-[var(--h-post-writer)] ${getBottomOverlayShown() ? '' : 'hidden'}`}
	>
		{#if gs.showReactionHistory}
			<ReactionHistory />
		{:else}
			<PostWriter onSubmit={submitPost} />
		{/if}
	</div>
	{#if viewPostToastId}
		<a
			href={'/' + viewPostToastId}
			class="z-50 fixed bottom-2 self-center fx h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-2 border-hl1 hover:border-hl2"
		>
			{m.viewPost()}
			<IconChevronRight class="h-5" stroke={3} />
		</a>
	{/if}
</div>
