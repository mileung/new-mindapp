<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import { scrollToHighlight, scrollToLastY, textInputFocused } from '$lib/dom';
	import {
		getBottomOverlayShown,
		gs,
		makeFeedIdentifier,
		resetBottomOverlay,
	} from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { hasParent } from '$lib/types/parts';
	import {
		getAtIdStr,
		getIdStr,
		getIdStrAsIdObj,
		getUrlInMs,
		id0,
		idsRegex,
		isIdStr,
		type FullIdObj,
		type IdObj,
	} from '$lib/types/parts/partIds';
	import { getCitedPostIds, getLastVersion, normalizeTags, type Post } from '$lib/types/posts';
	import { addPost } from '$lib/types/posts/addPost';
	import { editPost } from '$lib/types/posts/editPost';
	import {
		bracketRegex,
		getPostFeed,
		postsPerLoad,
		type GetPostFeedQuery,
	} from '$lib/types/posts/getPostFeed';
	import { getCurrentSpacePermissions, getPromptSigningIn } from '$lib/types/spaces';
	import {
		IconArchive,
		IconChevronRight,
		IconClockUp,
		IconEye,
		IconInbox,
		IconList,
		IconListTree,
		IconMessage2Up,
		IconPencilPlus,
		IconSquareFilled,
		IconStack2,
		IconX,
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import Apush from './Apush.svelte';
	import PostBlock from './PostBlock.svelte';
	import PostWriter from './PostWriter.svelte';
	import PromptSignIn from './PromptSignIn.svelte';
	import ReactionHistory from './ReactionHistory.svelte';

	let timeGetPostFeed = dev;
	timeGetPostFeed = false;

	let byMssRegex = /(^|\s)\/_\d+_\/($|\s)/g;
	let quoteRegex = /"([^"]+)"/g;
	let p: { hidden?: boolean; modal?: boolean; qSearchParam: string; tidStr?: string } = $props();
	let postIdStrFeed = $state<string[]>([]);
	let postAtBumpedPostIdObjsExclude = $state<FullIdObj[]>();
	let endReached = $state(false);
	let feedError = $state('');
	let viewPostToastId = $state('');
	let urlInMs = $derived(getUrlInMs());

	let view = $derived<'flat' | 'nested'>(
		page.url.searchParams.get('flat') !== null ? 'flat' : 'nested',
	);
	let sortedBy = $derived.by<'bumped' | 'new' | 'old'>(() => {
		let params = page.url.searchParams;
		return params.get('new') !== null //
			? 'new'
			: params.get('old') !== null
				? 'old'
				: 'bumped';
	});

	let shown = $state(!p.hidden);
	$effect(() => {
		!shown && !p.hidden && (shown = true);
	});
	let identifier = $derived(
		shown && gs.accounts && p.tidStr
			? makeFeedIdentifier({
					view,
					sortedBy,
					qSearchParam: p.qSearchParam,
					idParam: p.tidStr,
					byMs: p.tidStr !== '__0' && p.tidStr !== '__8' ? gs.accounts[0].ms : 0,
				})
			: '',
	);
	let nested = $derived(view === 'nested');
	let permissions = $derived(getCurrentSpacePermissions());
	let membership = $derived(
		gs.accountMsToSpaceMsToMembershipMap[gs.accounts?.[0].ms || 0]?.[gs.currentSpaceMs || 0],
	);
	let isViewOnly = $derived(
		gs.currentSpaceMs &&
			gs.accounts?.[0].ms !== gs.currentSpaceMs &&
			(membership === null ||
				(membership && //
					!permissions?.canReact &&
					!permissions?.canPost)),
	);
	let showYourTurn = $derived(!!membership);
	let spotId = $derived(isIdStr(p.tidStr) && p.tidStr!);
	let promptSignIn = $derived(getPromptSigningIn());
	let allowPosting = $derived(!p.modal && !promptSignIn && permissions?.canPost);

	onMount(() => {
		let handler = (e: KeyboardEvent) => {
			if (!p.hidden && !textInputFocused()) {
				// TODO: press b to sort feed by bumped
				// TODO: press n to sort feed by new
				// TODO: press o to sort feed by old
				// TODO: press f to sort feed by first

				// TODO: press r to reply to current highlighted or hovered post
				// TODO: press e to edit to current highlighted or hovered post
				// TODO: press c to cite current highlighted or hovered post

				// TODO: press left/right to highlight next adjacent post
				// TODO: press shift left/right to highlight next depth 0 post
				if (allowPosting && e.key === 'n' && !gs.writingNew && !gs.writingTo && !gs.writingEdit) {
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

	// $effect(() => {
	// 	if ((gs.writingNew || gs.writingTo || gs.writingEdit) && !!urlInMs && !gs.accounts?.[0].ms) {
	// 		alert(m.signInToPostInThisSpace());
	// 		resetBottomOverlay();
	// 	}
	// });

	$effect(() => {
		identifier;
		// TODO: use gs.indentifierToFeedMap with time/write based cache invalidations
		postIdStrFeed = [];
		postAtBumpedPostIdObjsExclude = undefined;
		endReached = false;
	});
	let loadMorePosts = async (e: InfiniteEvent) => {
		// await new Promise((res) => setTimeout(res, 1000));
		// console.log(
		// 	'loadMorePosts:',
		// 	identifier,
		// 	// $state.snapshot(gs.feeds[identifier]),
		// 	// $state.snapshot(gs.posts),
		// );

		// TODO: load locally saved postIdStrFeed and only fetch new ones if the user scrolls or interacts with the feed. This is to reduce unnecessary requests when the user just wants to add a post via the extension

		if (urlInMs === undefined || !gs.accounts || promptSignIn) return;
		if (endReached) return e.detail.complete();
		let lastPostIdStr = (postIdStrFeed as (undefined | string)[]).slice(-1)[0];
		let lastPostIdObj = lastPostIdStr ? getIdStrAsIdObj(lastPostIdStr) : null;
		let postFeed: Awaited<ReturnType<typeof getPostFeed>>;
		let baseQueryParams: GetPostFeedQuery = {
			view,
			sortedBy,
			postAtBumpedPostIdObjsExclude,
			fromMs:
				sortedBy === 'bumped' //
					? postAtBumpedPostIdObjsExclude?.slice(-1)[0]?.ms
					: lastPostIdObj?.ms,
			byMssExclude: [],
			byMssInclude: [],
			inMssExclude: [],
			inMssInclude: [urlInMs],
			postIdObjsExclude: [],
			postIdObjsInclude: [],
			tagsExclude: [],
			tagsInclude: [],
			coreExcludes: [],
			coreIncludes: [],
		};

		try {
			if (spotId) {
				postFeed = await getPostFeed({
					...baseQueryParams,
					postIdObjsInclude: [getIdStrAsIdObj(spotId)],
				});
			} else {
				// TODO: Instead of set theory, implement tag groups
				let citedIds = getCitedPostIds(p.qSearchParam);
				let tagsInclude = (p.qSearchParam?.match(bracketRegex) || []).map((match) =>
					match.slice(1, -1),
				);
				let byMssInclude = p.qSearchParam.match(byMssRegex)?.map((a) => +a.slice(1)) || [];
				let qSearchParamNoTagsOrAuthors = p.qSearchParam
					.replace(bracketRegex, ' ')
					.replace(byMssRegex, ' ');
				let quotes = (qSearchParamNoTagsOrAuthors.match(quoteRegex) || []).map((match) =>
					match.slice(1, -1),
				);
				let coreIncludes = [
					...quotes,
					...citedIds,
					...qSearchParamNoTagsOrAuthors
						.replace(quoteRegex, ' ')
						.replace(idsRegex, ' ')
						.split(/\s+/g)
						.filter((a) => !!a)
						.map((s) => s.toLowerCase()),
				];

				let lastRootIdObjsWithSameMs: IdObj[] = lastPostIdObj ? [lastPostIdObj] : [];
				for (let i = postIdStrFeed.length - 1; i >= 0; i--) {
					let split = getIdStrAsIdObj((postIdStrFeed as string[])[i]);
					if (split.ms === lastPostIdObj!.ms) {
						lastRootIdObjsWithSameMs.push(split);
					} else break;
				}

				timeGetPostFeed && console.time('getPostFeed');
				postFeed = await getPostFeed({
					...baseQueryParams,
					byMssInclude,
					tagsInclude,
					coreIncludes: coreIncludes,
					postAtBumpedPostIdObjsExclude,
					postIdObjsExclude: [...lastRootIdObjsWithSameMs],
				});
				timeGetPostFeed && console.timeEnd('getPostFeed');
				postAtBumpedPostIdObjsExclude = postFeed.postAtBumpedPostIdObjsExclude;
			}
			let { postIdStrFeed: newPostIdStrFeed, idToPostMap: newIdToPostMap } = postFeed;
			gs.msToAccountNameTxtMap = {
				...gs.msToAccountNameTxtMap,
				...postFeed.msToAccountNameTxtMap,
			};

			Object.entries(postFeed.spaceMsToMapOwnerAccountMs).forEach(
				([spaceMs, ownerAccountMsMap]) => {
					let ms = +spaceMs;
					if (!gs.spaceMsToMapOwnerAccountMs[ms]) gs.spaceMsToMapOwnerAccountMs[ms] = {};
					gs.spaceMsToMapOwnerAccountMs[ms] = {
						...gs.spaceMsToMapOwnerAccountMs[ms],
						...ownerAccountMsMap,
					};
				},
			);

			Object.entries(postFeed.spaceMsToMapModAccountMs).forEach(([spaceMs, modAccountMsMap]) => {
				let ms = +spaceMs;
				if (!gs.spaceMsToMapModAccountMs[ms]) gs.spaceMsToMapModAccountMs[ms] = {};
				gs.spaceMsToMapModAccountMs[ms] = {
					...gs.spaceMsToMapModAccountMs[ms],
					...modAccountMsMap,
				};
			});

			let newPostMapEntries = Object.entries(newIdToPostMap);
			for (let i = 0; i < newPostMapEntries.length; i++) {
				let [id, post] = newPostMapEntries[i];
				let lastVersion = getLastVersion(newIdToPostMap[id]);
				if (lastVersion !== null && newIdToPostMap[id].history?.[lastVersion]) {
					newIdToPostMap[id].history[lastVersion].tags =
						newIdToPostMap[id].history[lastVersion].tags || [];
					newIdToPostMap[id].history[lastVersion].tags.sort();
					if (!lastVersion) newIdToPostMap[id].history[lastVersion].ms = getIdStrAsIdObj(id).ms!;
				}
				if (hasParent(post)) {
					let strAtId = getAtIdStr(post);
					if (!gs.idToPostMap[strAtId]) gs.idToPostMap[strAtId] = { ...id0, history: {} };
					gs.idToPostMap[strAtId].subIds = [
						...new Set([...(gs.idToPostMap[strAtId]?.subIds || []), id]),
					];
					gs.idToPostMap[strAtId].subIds.sort(
						(a, b) => getIdStrAsIdObj(b).ms! - getIdStrAsIdObj(a).ms!,
					);
				}
				gs.idToPostMap[id] = { ...gs.idToPostMap[id], ...newIdToPostMap[id] };
			}

			endReached = newPostIdStrFeed.length < postsPerLoad;
			postIdStrFeed = [...new Set([...postIdStrFeed, ...newPostIdStrFeed])];
			newPostIdStrFeed.length && e.detail.loaded();
			endReached && e.detail.complete();
		} catch (error) {
			// @ts-ignore
			feedError = String(error?.message || m.placeholderError());
			e.detail.error();
		}
	};

	let submitPost = async (tags: string[], core: string) => {
		if (!gs.accounts || !identifier) return;
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
			// if (!urlInMs) {
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
				in_ms: gs.currentSpaceMs!,
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
				if (!!urlInMs) await addPost(post, true);
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
			postIdStrFeed = [strPostId, ...postIdStrFeed];
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
		let s = newSortedBy === 'bumped' ? '' : newSortedBy;
		let queryParams = `?${v}${v && s ? '&' : ''}${s}`;
		return queryParams === '?' ? page.url.pathname : queryParams;
	};

	let postObjFeed = $derived(
		postIdStrFeed?.map((strPostId) => gs.idToPostMap[strPostId || 0]).filter((t) => !!t),
	);
	let scrolledToSpotId = $state(false);
	$effect(() => {
		if (spotId && !scrolledToSpotId && postObjFeed?.length) {
			setTimeout(() => scrollToHighlight(spotId), 0);
		}
	});

	let endingPanelClass = $derived.by(() =>
		!!gs.pendingInvite //
			? `h-[calc(100vh-36px-36px)] xs:h-[calc(100vh-36px)]`
			: 'h-[calc(100vh-36px)]  xs:h-screen',
	);
</script>

<div
	id={p.hidden ? '' : 'feed'}
	class={`z-50 flex flex-col ${gs.pendingInvite ? 'h- screen-[calc(100vh-36px)]' : 'h- screen'} ${p.hidden ? 'hidden' : ''}`}
>
	{#if urlInMs === undefined}
		<!--  -->
	{:else if promptSignIn}
		<PromptSignIn />
		<!-- {:else if urlInMs === 1}
		patience -->
	{:else}
		{#if isViewOnly}
			<div class="shrink-0 h-9 fx">
				<IconEye class="w-6 ml-0.5 mr-2" />
				<p class="font-bold text-xl">{m.viewOnlyMode()}</p>
			</div>
			<p class="ml-1.5">
				{m.youMayContributeToThisSpaceOnceYouReInvited()}
			</p>
		{:else if showYourTurn}
			<div class="shrink-0 h-9 fx">
				<IconInbox class="w-6 ml-0.5 mr-2" />
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
			<div class="mt-2 fx">
				<IconStack2 class="w-6 ml-0.5 mr-2" />
				<p class="font-bold text-xl leading-4">{m.nextUp()}</p>
			</div>
		{/if}
		<div
			class={`flex w-full text-fg2 overflow-scroll shrink-0 ${showYourTurn ? 'h-8' : 'h-9'} ${spotId ? 'hidden' : ''}`}
		>
			<a
				href={makeParams('nested', sortedBy)}
				class={` fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${view === 'nested' ? 'text-fg1' : ''}`}
			>
				<IconListTree stroke={2.5} class="h-4" />{m.nested()}
			</a>
			<a
				href={makeParams('flat', sortedBy)}
				class={` fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${view === 'flat' ? 'text-fg1' : ''}`}
			>
				<IconList stroke={2.5} class="h-4" />{m.flat()}
			</a>
			<div class="xy mr-0.5">
				<IconSquareFilled class="h-1.5 w-1.5" />
			</div>
			<a
				href={makeParams(view, 'bumped')}
				class={` fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${sortedBy === 'bumped' ? 'text-fg1' : ''}`}
			>
				<IconMessage2Up stroke={2.5} class="h-4" />
				{m.bumped()}
			</a>
			<a
				href={makeParams(view, 'new')}
				class={` fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${sortedBy === 'new' ? 'text-fg1' : ''}`}
			>
				<IconClockUp stroke={2.5} class="h-4" />{m.new()}
			</a>
			<a
				href={makeParams(view, 'old')}
				class={` fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${sortedBy === 'old' ? 'text-fg1' : ''}`}
			>
				<IconArchive stroke={2.5} class="h-4" />{m.old()}
			</a>
		</div>
		{#each postObjFeed || [] as post, i (getIdStr(post))}
			{#if spotId && i === 1}
				<p class="m-2 text-center text-fg2 text-lg">{m.citedIn()}</p>
			{/if}
			<PostBlock {...p} {post} depth={0} nested={spotId ? !i : nested} />
		{/each}
		<InfiniteLoading {identifier} spinner="spiral" on:infinite={loadMorePosts}>
			<div slot="noResults" class={endingPanelClass}>
				<p class="m-2 text-lg text-fg2">
					<!-- TODO: noResults shows after deleting the one and only post then making another new post in Local  -->
					{postObjFeed?.length ? m.endOfFeed() : m.noPostsFound()}
				</p>
			</div>
			<div slot="noMore" class={endingPanelClass}>
				<p class="m-2 text-lg text-fg2">{m.endOfFeed()}</p>
			</div>
			<p slot="error" class="m-2 text-lg text-fg2">
				{feedError}
			</p>
		</InfiniteLoading>
	{/if}
	{#if p.modal && urlInMs !== undefined}
		<a
			href={`/__${urlInMs}`}
			onclick={scrollToLastY}
			class="z-50 fixed xy right-0 bottom-9 xs:bottom-0 h-9 w-9 bg-bg5 border-b-2 border-hl1 hover:bg-bg7 hover:text-fg3 hover:border-hl2"
		>
			<IconX class="w-8" />
		</a>
	{:else if allowPosting}
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
		<Apush
			href={'/' + viewPostToastId}
			class="z-50 fixed bottom-2 self-center fx h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-2 border-hl1 hover:border-hl2"
		>
			{m.viewPost()}
			<IconChevronRight class="h-5" stroke={3} />
		</Apush>
	{/if}
</div>
