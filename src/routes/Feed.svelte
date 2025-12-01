<script lang="ts">
	import { dev } from '$app/environment';
	import { goto, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { textInputFocused } from '$lib/dom';
	import { getUndefinedLocalFeedIds, gs, makeFeedIdentifier } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { hasParent } from '$lib/types/parts';
	import {
		getAtIdStr,
		getIdStr,
		getIdStrAsIdObj,
		idsRegex,
		isIdStr,
		isTemplateId,
		zeros,
		type IdObj,
	} from '$lib/types/parts/partIds';
	import {
		getCitedPostIds,
		getLastVersion,
		normalizeTags,
		scrollToHighlight,
		type Post,
	} from '$lib/types/posts';
	import { addPost } from '$lib/types/posts/addPost';
	import { editPost } from '$lib/types/posts/editPost';
	import {
		bracketRegex,
		getPostFeed,
		postsPerLoad,
		type GetPostFeedQuery,
	} from '$lib/types/posts/getPostFeed';
	import { getPromptSigningIn } from '$lib/types/spaces';
	import {
		IconArchive,
		IconChevronRight,
		IconClockUp,
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
	import PostBlock from './PostBlock.svelte';
	import PostWriter from './PostWriter.svelte';
	import PromptSignIn from './PromptSignIn.svelte';

	let timeGetPostFeed = dev;
	timeGetPostFeed = false;

	let byMssRegex = /(^|\s)\/_\d+_\/($|\s)/g;
	let quoteRegex = /"([^"]+)"/g;
	let p: { hidden?: boolean; modal?: boolean; searchedText: string; idParam?: string } = $props();

	let validUrl = $state(true);
	let viewPostToastId = $state('');
	let idParamObj = $derived(page.params.id ? getIdStrAsIdObj(page.params.id) : null);
	let inLocal = $derived(idParamObj?.in_ms === 0);

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
	let identifier = $derived(
		gs.accounts && p.idParam
			? makeFeedIdentifier({
					view,
					sortedBy,
					searchedText: p.searchedText,
					idParam: p.idParam,
					byMs: p.idParam !== '__0' && p.idParam !== '__8' ? gs.accounts[0].ms : 0,
				})
			: '',
	);
	let nested = $derived(view === 'nested');
	let showYourTurn = $derived((idParamObj?.in_ms || 0) > 0);
	let spotId = $derived(isIdStr(p.idParam) && p.idParam!);
	let promptSignIn = $derived(getPromptSigningIn(idParamObj));
	let allowNewWriting = $derived(!p.modal && !promptSignIn && gs.currentSpaceMs !== 1);

	onMount(() => {
		if (timeGetPostFeed) gs.indentifierToFeedMap = {};
		let handler = (e: KeyboardEvent) => {
			if (!p.hidden && !textInputFocused()) {
				if (
					allowNewWriting &&
					e.key === 'n' &&
					!gs.writingNew &&
					!gs.writingTo &&
					!gs.writingEdit
				) {
					e.preventDefault();
					clearTimeout(countDownTimer);
					gs.writingNew = true;
				}
			}
		};
		window.addEventListener('keydown', handler);
		return () => {
			if (timeGetPostFeed) gs.indentifierToFeedMap = {};
			gs.writingNew = gs.writingTo = gs.writingEdit = false;
			window.removeEventListener('keydown', handler);
			clearTimeout(countDownTimer);
		};
	});

	let secondsRemaining = $state(-1);
	let countDownTimer = $state<NodeJS.Timeout>();
	let startCountDown = () => {
		secondsRemaining = 8;
		let decrement = () => {
			secondsRemaining--;
			if (secondsRemaining) {
				countDownTimer = setTimeout(decrement, 1000);
			} else goto('/user-guide');
		};
		countDownTimer = setTimeout(decrement, 1000);
	};

	$effect(() => {
		if (gs.writingNew || p.idParam !== '__0') {
			clearTimeout(countDownTimer);
			secondsRemaining = -1;
		}
	});

	$effect(() => {
		if ((gs.writingNew || gs.writingTo || gs.writingEdit) && !inLocal && !gs.accounts?.[0].ms) {
			alert(m.signInToPostInThisSpace());
			gs.writingNew = gs.writingTo = gs.writingEdit = false;
		}
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

		if (!idParamObj || !gs.accounts || promptSignIn) return;
		validUrl = isTemplateId(p.idParam || '');
		if (!validUrl) return e.detail.error();

		let postIdStrFeed = gs.indentifierToFeedMap[identifier] || [];
		let lastPostIdStr = (postIdStrFeed as (null | undefined | string)[]).slice(-1)[0];
		if (lastPostIdStr === null) return e.detail.complete();
		let lastPostIdObj = lastPostIdStr ? getIdStrAsIdObj(lastPostIdStr) : null;
		let postFeed: Awaited<ReturnType<typeof getPostFeed>>;

		let baseQueryParams: GetPostFeedQuery = {
			useRpc: !inLocal,
			callerMs: gs.accounts[0].ms,
			view,
			sortedBy,
			fromMs:
				lastPostIdObj?.ms || //
				(sortedBy === 'old' ? 0 : Number.MAX_SAFE_INTEGER),
			byMssExclude: [],
			byMssInclude: [],
			inMssExclude: [],
			inMssInclude: [idParamObj.in_ms],
			postIdObjsExclude: [],
			postIdObjsInclude: [],
			tagsExclude: [],
			tagsInclude: [],
			coreExcludes: [],
			coreIncludes: [],
		};

		if (spotId) {
			console.log('spotId:', spotId);
			postFeed = await getPostFeed({
				...baseQueryParams,
				postIdObjsInclude: [getIdStrAsIdObj(spotId)],
			});
			console.log('postFeed:', postFeed);
		} else {
			// TODO: Instead of set theory, implement tag groups
			let citedIds = getCitedPostIds(p.searchedText);
			let tagsInclude = (p.searchedText?.match(bracketRegex) || []).map((match) =>
				match.slice(1, -1),
			);
			let byMssInclude = p.searchedText.match(byMssRegex)?.map((a) => +a.slice(1)) || [];
			let searchedTextNoTagsOrAuthors = p.searchedText
				.replace(bracketRegex, ' ')
				.replace(byMssRegex, ' ');
			let quotes = (searchedTextNoTagsOrAuthors.match(quoteRegex) || []).map((match) =>
				match.slice(1, -1),
			);
			let coreIncludes = [
				...quotes,
				...citedIds,
				...searchedTextNoTagsOrAuthors
					.replace(quoteRegex, ' ')
					.replace(idsRegex, ' ')
					.split(/\s+/g)
					.filter((a) => !!a)
					.map((s) => s.toLowerCase()),
			];

			let lastRootIdObjsWithSameMs: IdObj[] = lastPostIdObj ? [lastPostIdObj] : [];
			for (let i = postIdStrFeed.length - 3; i >= 0; i--) {
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
				postIdObjsExclude: [...lastRootIdObjsWithSameMs],
			});
			timeGetPostFeed && console.timeEnd('getPostFeed');
		}
		let { postIdStrFeed: newPostIdStrFeed, idToPostMap } = postFeed;
		// console.log('postFeed:', postFeed);

		let postMapEntries = Object.entries(idToPostMap);
		for (let i = 0; i < postMapEntries.length; i++) {
			let [id, post] = postMapEntries[i];
			idToPostMap[id].subIds = idToPostMap[id].subIds || [];
			let lastVersion = getLastVersion(idToPostMap[id]);
			if (lastVersion !== null && idToPostMap[id].history?.[lastVersion]) {
				idToPostMap[id].history[lastVersion].tags = idToPostMap[id].history[lastVersion].tags || [];
				idToPostMap[id].history[lastVersion].tags.sort();
				if (!lastVersion) idToPostMap[id].history[lastVersion].ms = getIdStrAsIdObj(id).ms!;
			}
			if (hasParent(post)) {
				let strAtId = getAtIdStr(post);
				if (idToPostMap[strAtId]) {
					idToPostMap[strAtId].subIds = idToPostMap[strAtId].subIds || [];
					idToPostMap[strAtId].subIds.push(id);
				}
				// else a cited post has an atId, but cites don't show parents,
				// so the parent is not in idToPostMap.
				// At least this is one cause for idToPostMap[strAtId] === undefined
			}
		}
		for (let i = 0; i < postMapEntries.length; i++) {
			let [id] = postMapEntries[i];
			idToPostMap[id].subIds!.sort((a, b) => getIdStrAsIdObj(b).ms! - getIdStrAsIdObj(a).ms!);
		}

		let endReached = newPostIdStrFeed.length < postsPerLoad;
		gs.idToPostMap = { ...gs.idToPostMap, ...idToPostMap };
		gs.indentifierToFeedMap[identifier] = [
			...(gs.indentifierToFeedMap[identifier] || []),
			...newPostIdStrFeed,
			...(endReached ? [null] : []),
		];
		endReached ? e.detail.complete() : e.detail.loaded();

		if (p.idParam === '__0' && !p.searchedText && endReached && !postIdStrFeed.length) {
			!dev && startCountDown();
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
			// if (inLocal) {
			// 	Number.isInteger(post.in_ms) ? updateInCloud() : (post.tags = await editPost(post, false));
			// } else updateInCloud();
			post.history![newLastVersion]!.ms = (await editPost(post, !inLocal)).ms;
		} else {
			post = {
				...zeros,
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
					0: {
						ms: 0,
						tags: normalizeTags(tags),
						core,
					},
				},
			};
			try {
				// TODO: fetch cited posts if not already in feed
				post.ms = (await addPost(post, !inLocal)).ms;
				post.history![0]!.ms = post.ms;
				post.subIds = [];
				if (!inLocal) await addPost(post, false);
			} catch (error) {
				console.log(error);
				return alert(error);
			}
		}

		let strPostId = getIdStr(post);
		gs.idToPostMap = { ...gs.idToPostMap, [strPostId]: post };
		if (gs.writingTo) {
			let atPostId = getAtIdStr(post);
			nested && gs.idToPostMap[atPostId!]!.subIds!.unshift(strPostId);
		}
		gs.indentifierToFeedMap = {
			...gs.indentifierToFeedMap,
			...getUndefinedLocalFeedIds(),
			[identifier]: [
				...((
					nested
						? gs.writingNew && (sortedBy === 'bumped' || sortedBy === 'new')
						: sortedBy === 'new'
				)
					? [strPostId]
					: []),
				...gs.indentifierToFeedMap[identifier]!,
			],
		};

		if (gs.writingNew || gs.writingTo) {
			viewPostToastId = strPostId;
			setTimeout(() => (viewPostToastId = ''), 3000);
		}
		gs.writingNew = gs.writingTo = gs.writingEdit = false;
	};

	let makeParams = (newView: 'nested' | 'flat', newSortedBy: 'bumped' | 'new' | 'old') => {
		let v = newView === 'nested' ? '' : newView;
		let s = newSortedBy === 'bumped' ? '' : newSortedBy;
		let queryParams = `?${v}${v && s ? '&' : ''}${s}`;
		return queryParams === '?' ? page.url.pathname : queryParams;
	};

	let postObjFeed = $derived(
		gs.indentifierToFeedMap[identifier]
			?.map((strPostId) => gs.idToPostMap[strPostId || 0])
			.filter((t) => !!t),
	);

	let scrolledToSpotId = $state(false);
	$effect(() => {
		if (spotId && !scrolledToSpotId && postObjFeed?.length) {
			setTimeout(() => scrollToHighlight(spotId), 0);
		}
	});
</script>

<div
	class={`overflow-y-scroll flex flex-col h-[calc(100vh-36px)] xs:h-screen ${p.hidden ? 'hidden' : ''}`}
>
	{#if !idParamObj}
		<!--  -->
	{:else if promptSignIn}
		<PromptSignIn />
	{:else if idParamObj?.in_ms === 1}
		patience
	{:else if idParamObj}
		<!-- <p class="font-bold text-xl">All Local posts</p> -->
		{#if showYourTurn}
			<div class="min-h-9 fx">
				<IconInbox class="w-6 ml-0.5 mr-2" />
				<p class="font-bold text-xl">Your turn</p>
			</div>
			<p class="ml-1.5">
				{@html m.signInToSeePostsAwaitingYourResponse()}
			</p>
			<div class="mt-2 fx">
				<IconStack2 class="w-6 ml-0.5 mr-2" />
				<p class="font-bold text-xl leading-4">All posts</p>
			</div>
		{/if}
		<div
			class={`${spotId ? 'hidden' : ''} ${showYourTurn ? 'min-h-8' : 'min-h-9'} flex w-full text-fg2 overflow-scroll`}
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
		{#each postObjFeed || [] as post (getIdStr(post))}
			<PostBlock {...p} {nested} {post} depth={0} />
		{/each}
		<InfiniteLoading {identifier} spinner="spiral" on:infinite={loadMorePosts}>
			<p slot="noResults" class="m-2 text-lg text-fg2">
				<!-- TODO: noResults shows after deleting the one and only post then making another new post in Local  -->
				{postObjFeed?.length ? m.endOfFeed() : m.noPostsFound()}
			</p>
			<p slot="noMore" class="m-2 text-lg text-fg2">{m.endOfFeed()}</p>
			<p slot="error" class="m-2 text-lg text-fg2">
				{validUrl ? m.placeholderError() : m.invalidUrl()}
			</p>
		</InfiniteLoading>
		{#if inLocal && !p.searchedText && postObjFeed && !postObjFeed.length}
			<div class="xy">
				<p class="">
					{@html secondsRemaining === -1 ? m.newHere__2() : m.newHere___({ secondsRemaining })}
				</p>
			</div>
		{/if}
	{/if}
	{#if p.modal && idParamObj}
		<a
			href={`/__${idParamObj.in_ms}`}
			class="z-50 fixed xy right-1 bottom-1 h-9 w-9 bg-bg5 border-b-4 border-hl1 hover:bg-bg7 hover:border-hl2"
		>
			<IconX class="w-8" />
		</a>
	{:else if allowNewWriting}
		<button
			class="z-40 fixed xy right-1 bottom-10 xs:bottom-1 h-8 w-8 xs:h-9 xs:w-9 text-bg1 bg-fg1 hover:bg-fg3"
			onclick={() => (gs.writingNew = true)}
		>
			<IconPencilPlus class="h-8 xs:h-9" />
		</button>
	{/if}
	<div class="flex-1"></div>
	<div
		class={`sticky bottom-0 z-50 h-[var(--h-post-writer)] ${gs.writingNew || gs.writingTo || gs.writingEdit ? '' : 'hidden'}`}
	>
		<PostWriter onSubmit={submitPost} />
	</div>
	{#if viewPostToastId}
		<a
			href={'/' + viewPostToastId}
			class="fx z-50 fixed h-10 pl-2 font-semibold bottom-2 self-center bg-bg5 hover:bg-bg7 border-b-4 border-hl1 hover:border-hl2"
			onclick={(e) => {
				if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
					e.preventDefault();
					pushState('/' + viewPostToastId, { modalId: viewPostToastId });
				}
			}}
		>
			{m.viewPost()}
			<IconChevronRight class="h-5" stroke={3} />
		</a>
	{/if}
</div>
