<script lang="ts">
	import { pushState } from '$app/navigation';
	import { textInputFocused } from '$lib/dom';
	import { getUndefinedLocalFeedIds, gs, makeFeedIdentifier } from '$lib/global-state.svelte';
	import { strIsInt } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags, updateLocalCache } from '$lib/types/local-cache';
	import {
		bracketRegex,
		getId,
		getToId,
		idsRegex,
		overwriteLocalPost,
		getSplitId,
		type SplitId,
	} from '$lib/types/parts';
	import {
		IconChevronRight,
		IconCornerUpLeft,
		IconPencil,
		IconPencilPlus,
		IconClockUp,
		IconX,
		IconArchive,
		IconMessage2Up,
		IconListTree,
		IconList,
		IconSquareFilled,
		IconMessage2Off,
		IconFilter,
		IconTags,
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import Highlight from './Highlight.svelte';
	import PostBlock from './PostBlock.svelte';
	import PostWriter from './PostWriter.svelte';
	import {
		getCitedPostIds,
		getLastVersion,
		normalizeTags,
		scrollToHighlight,
		type Post,
	} from '$lib/types/posts';
	import { getPostFeed, postsPerLoad } from '$lib/types/posts/getPostFeed';
	import { addPost } from '$lib/types/posts/addPost';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import { editPost } from '$lib/types/posts/editPost';

	let timeGetPostFeed = dev;
	timeGetPostFeed = false;

	let byMssRegex = /(^|\s)\/_\d*_\/($|\s)/g;
	let quoteRegex = /"([^"]+)"/g;
	let p: { hidden?: boolean; modal?: boolean; searchedText: string; idParam?: string } = $props();

	let invalidUrl = $state(false);
	let viewPostToastId = $state('');
	let splitIdParam = $derived(getSplitId(p.idParam || ''));
	let inLocal = $derived(splitIdParam.in_ms === null);
	$effect(() => {
		if (gs.accounts) {
			localStorage.setItem('callerMs', '' + gs.accounts[0].ms);
		}
	});

	let view = $derived(
		page.url.searchParams.get('linear') !== null ? ('linear' as const) : ('nested' as const),
	);
	let sortedBy = $derived.by<'bumped' | 'new' | 'old'>(() => {
		let params = page.url.searchParams;
		let linear = params.get('linear') !== null;
		if (params.get('new') !== null) return 'new';
		if (params.get('old') !== null) return 'old';
		return linear ? 'new' : 'bumped';
	});
	let identifier = $derived(
		gs.accounts && p.idParam
			? makeFeedIdentifier({
					view,
					sortedBy,
					searchedText: p.searchedText,
					idParam: p.idParam,
					callerMs: p.idParam !== 'l_l_' && p.idParam !== 'l_l_1' ? gs.accounts[0].ms : null,
				})
			: '',
	);
	let nested = $derived(view === 'nested');

	let spotId = $derived(p.idParam && p.idParam[0] !== 'l' ? p.idParam : '');
	let personalSpaceRequiresLogin = $derived(
		splitIdParam.in_ms === 0 && //
			gs.accounts?.[0].ms === null,
	);
	let allowNewWriting = $derived(!p.modal && !personalSpaceRequiresLogin);

	onMount(() => {
		if (timeGetPostFeed) gs.feeds = {};
		let handler = (e: KeyboardEvent) => {
			if (!p.hidden && !textInputFocused()) {
				if (
					e.key === 'n' &&
					!gs.writingNew &&
					!gs.writingTo &&
					!gs.writingEdit &&
					allowNewWriting
				) {
					e.preventDefault();
					gs.writingNew = true;
				}
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});

	$effect(() => {
		if ((gs.writingNew || gs.writingTo || gs.writingEdit) && !inLocal && !gs.accounts?.[0].ms) {
			alert(m.signInToPostInThisSpace());
			gs.writingNew = gs.writingTo = gs.writingEdit = false;
		}
	});

	let getTags = (input?: string) => {
		return (input?.match(bracketRegex) || []).map((match) => match.slice(1, -1));
	};

	let loadMorePosts = async (e: InfiniteEvent) => {
		// await new Promise((res) => setTimeout(res, 1000));
		console.log(
			'loadMorePosts:',
			identifier,
			// $state.snapshot(gs.feeds[identifier]),
			// $state.snapshot(gs.posts),
		);

		// TODO: load locally saved postIds and only fetch new ones if the user scrolls or interacts with the feed. This is to reduce unnecessary requests when the user just wants to add a post via the extension

		let arr = (p.idParam || '').split('_');
		if (
			arr.length !== 3 ||
			(arr[0] !== '' && arr[0] !== 'l' && Number.isNaN(splitIdParam.ms)) ||
			(arr[1] !== '' && arr[1] !== 'l' && Number.isNaN(splitIdParam.by_ms)) ||
			(arr[2] !== '' && arr[2] !== 'l' && Number.isNaN(splitIdParam.in_ms))
		) {
			invalidUrl = true;
			return e.detail.error();
		}
		invalidUrl = false;

		if (!gs.accounts || !identifier || !p.idParam || personalSpaceRequiresLogin) return;
		let lastPostId = (gs.feeds[identifier] || []).slice(-1)[0];
		if (lastPostId === null) return e.detail.complete();
		let feedPostIds = (gs.feeds[identifier] as string[]) || [];
		let lastPostMs = lastPostId ? getSplitId(lastPostId).ms! : null;
		let fromMs =
			lastPostMs || sortedBy === 'old' //
				? 0
				: Number.MAX_SAFE_INTEGER;
		let inMssInclude = splitIdParam.in_ms === null ? [] : [splitIdParam.in_ms];
		let callerMs = gs.accounts[0].ms || undefined;
		let postFeed: Awaited<ReturnType<typeof getPostFeed>>;
		if (spotId) {
			console.log('spotId:', spotId);
			postFeed = await getPostFeed({
				useRpc: !inLocal,
				callerMs,
				inMssInclude,
				fromMs,
				splitIdsInclude: [getSplitId(spotId)],
			});
			console.log('postFeed:', postFeed);
		} else {
			// TODO: Instead of set theory, implement tag groups
			let citedIds = getCitedPostIds(p.searchedText);
			let tagsInclude = getTags(p.searchedText);
			let byMssInclude = p.searchedText.match(byMssRegex)?.map((a) => +a.slice(1));
			let searchedTextNoTagsOrAuthors = p.searchedText
				.replace(bracketRegex, ' ')
				.replace(byMssRegex, ' ');
			let quotes = (searchedTextNoTagsOrAuthors.match(quoteRegex) || []).map((match) =>
				match.slice(1, -1),
			);
			let bodyIncludes = [
				...quotes,
				...citedIds,
				...searchedTextNoTagsOrAuthors
					.replace(quoteRegex, ' ')
					.replace(idsRegex, ' ')
					.split(/\s+/g)
					.filter((a) => !!a)
					.map((s) => s.toLowerCase()),
			];

			let lastRootLatestIdsWithSameMs: SplitId[] = lastPostId ? [getSplitId(lastPostId)] : [];
			for (let i = feedPostIds.length - 2; i >= 0; i--) {
				let split = getSplitId(feedPostIds[i]);
				if (split.ms === lastPostMs) {
					lastRootLatestIdsWithSameMs.push(split);
				} else break;
			}

			console.log('tagsInclude:', tagsInclude);
			console.log('bodyIncludes:', bodyIncludes);

			timeGetPostFeed && console.time('getPostFeed');
			postFeed = await getPostFeed({
				useRpc: !inLocal,
				callerMs,
				view,
				sortedBy,
				fromMs,
				inMssInclude,
				byMssInclude,
				tagsInclude,
				bodyIncludes,
				splitIdsExclude: [...lastRootLatestIdsWithSameMs],
			});
			timeGetPostFeed && console.timeEnd('getPostFeed');
		}
		let { postIds, postMap } = postFeed;
		// console.log('postFeed:', postFeed);

		let postMapEntries = Object.entries(postMap);
		for (let i = 0; i < postMapEntries.length; i++) {
			let [id, post] = postMapEntries[i];
			postMap[id].subIds = postMap[id].subIds || [];
			let lastVersion = getLastVersion(postMap[id]);
			if (lastVersion !== null && postMap[id].history?.[lastVersion]) {
				postMap[id].history[lastVersion].tags = postMap[id].history[lastVersion].tags || [];
				postMap[id].history[lastVersion].tags.sort();
				if (!lastVersion) postMap[id].history[lastVersion].ms = getSplitId(id).ms!;
			}
			let toId = getToId(post);
			if (toId) {
				postMap[toId].subIds = postMap[toId].subIds || [];
				postMap[toId].subIds.push(id);
			}
		}
		for (let i = 0; i < postMapEntries.length; i++) {
			let [id] = postMapEntries[i];
			postMap[id].subIds!.sort((a, b) => getSplitId(b).ms! - getSplitId(a).ms!);
		}

		let endReached = postIds.length < postsPerLoad;
		gs.posts = { ...gs.posts, ...postMap };
		gs.feeds[identifier] = [
			...(gs.feeds[identifier] || []),
			...postIds,
			...(endReached ? [null] : []),
		];
		endReached ? e.detail.complete() : e.detail.loaded();
	};

	let submitPost = async (tags: string[], body: string) => {
		if (!gs.accounts || !identifier) return;
		let savedTagsCountBefore = gs.accounts[0].savedTags.length;
		await updateLocalCache((lc) => {
			lc.accounts[0].savedTags = normalizeTags([...lc.accounts![0].savedTags, ...tags]);
			return lc;
		});
		let savedTagsCountAfter = gs.accounts[0].savedTags.length;
		if (savedTagsCountBefore < savedTagsCountAfter) {
			await updateSavedTags({ adding: tags, removing: [] });
		}

		let post: Post;
		if (gs.writingEdit) {
			let postBeingEdited = gs.posts[getId(gs.writingEdit)]!;
			let newLastVersion = getLastVersion(postBeingEdited)! + 1;
			post = {
				...postBeingEdited,
				history: {
					...postBeingEdited.history,
					[newLastVersion]: {
						ms: 0,
						tags,
						body,
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
				...(gs.writingTo
					? {
							to_ms: gs.writingTo.ms,
							to_by_ms: gs.writingTo.by_ms,
							to_in_ms: gs.writingTo.in_ms,
						}
					: {}),
				ms: 0,
				by_ms: gs.accounts[0].ms,
				in_ms: gs.currentSpaceMs,
				history: {
					0: {
						ms: 0,
						tags: normalizeTags(tags),
						body: body,
					},
				},
			};
			try {
				post.ms = (await addPost(post, !inLocal)).ms;
				post.history![0]!.ms = post.ms;
				post.subIds = [];
				if (!inLocal) await addPost(post, false);
			} catch (error) {
				console.log(error);
				return alert(error);
			}
		}

		let postId = getId(post);
		gs.posts = { ...gs.posts, [postId]: post };
		if (gs.writingTo) {
			let toPostId = getToId(post);
			nested && gs.posts[toPostId!]!.subIds!.unshift(postId);
		}
		gs.feeds = {
			...gs.feeds,
			...getUndefinedLocalFeedIds(),
			[identifier]: [
				...((
					nested
						? gs.writingNew && (sortedBy === 'bumped' || sortedBy === 'new')
						: sortedBy === 'new'
				)
					? [postId]
					: []),
				...gs.feeds[identifier]!,
			],
		};

		if (gs.writingNew || gs.writingTo) {
			viewPostToastId = postId;
			setTimeout(() => (viewPostToastId = ''), 3000);
		}
		gs.writingNew = gs.writingTo = gs.writingEdit = false;
	};

	let makeParams = (newView: 'nested' | 'linear', newSortedBy: 'bumped' | 'new' | 'old') => {
		let v = newView === 'nested' ? '' : newView;
		let s =
			newView === 'nested'
				? newSortedBy === 'bumped'
					? ''
					: newSortedBy
				: newSortedBy === 'new'
					? ''
					: newSortedBy;
		if (newView === 'linear' && newSortedBy === 'bumped') {
			if (view === 'nested' && sortedBy === 'bumped') s = '';
			if (view === 'linear' && sortedBy === 'new') v = s = '';
		}
		let queryParams = `?${v}${v && s ? '&' : ''}${s}`;
		return queryParams === '?' ? page.url.pathname : queryParams;
	};

	let feed = $derived(
		gs.feeds[identifier]?.map((postId) => gs.posts[postId || 0]).filter((t) => !!t),
	);

	let scrolledToSpotId = $state(false);
	$effect(() => {
		if (spotId && !scrolledToSpotId && feed?.length) {
			setTimeout(() => scrollToHighlight(spotId), 0);
		}
	});
</script>

<div
	class={`overflow-y-scroll flex flex-col h-[calc(100vh-36px)] xs:h-screen ${p.hidden ? 'hidden' : ''}`}
>
	{#if !!gs.accounts && personalSpaceRequiresLogin}
		<div class="h-screen xy fy gap-2">
			<p class="text-2xl font-black">{m.signInToUseThisSpace()}</p>
			<a
				href="/sign-in"
				class="fx h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 border-b-4 border-hl1"
			>
				{m.addAccount()}
				<IconChevronRight class="h-5" stroke={3} />
			</a>
		</div>
		<!-- {:else if p.idParam === 'l_l_' && !p.searchedText && feed && !feed.length}
		welcome -->
	{:else}
		<div class={`${spotId ? 'hidden' : ''} flex min-h-9 w-full text-fg2 overflow-scroll`}>
			<a
				href={makeParams('nested', sortedBy)}
				class={`fx pr-1.5 hover:text-fg1 ${view === 'nested' ? 'text-fg1' : ''}`}
			>
				<IconListTree stroke={2.5} class="h-4" />{m.nested()}
			</a>
			<a
				href={makeParams('linear', sortedBy)}
				class={`fx pr-1.5 hover:text-fg1 ${view === 'linear' ? 'text-fg1' : ''}`}
			>
				<IconList stroke={2.5} class="h-4" />{m.linear()}
			</a>
			<div class="xy mr-0.5">
				<IconSquareFilled class="h-1.5 w-1.5" />
			</div>
			<a
				href={makeParams(view, 'bumped')}
				class={`relative fx pr-1.5 hover:text-fg1 ${sortedBy === 'bumped' ? 'text-fg1' : ''}`}
			>
				<IconMessage2Up stroke={2.5} class="h-4" />
				{m.bumped()}
			</a>
			<a
				href={makeParams(view, 'new')}
				class={`fx pr-1.5 hover:text-fg1 ${sortedBy === 'new' ? 'text-fg1' : ''}`}
			>
				<IconClockUp stroke={2.5} class="h-4" />{m.new()}
			</a>
			<a
				href={makeParams(view, 'old')}
				class={`fx pr-1.5 hover:text-fg1 ${sortedBy === 'old' ? 'text-fg1' : ''}`}
			>
				<IconArchive stroke={2.5} class="h-4" />{m.old()}
			</a>
			<a
				href={`/l_l_${gs.currentSpaceMs ?? ''}/tags`}
				class={`ml-auto fx pr-1.5 hover:text-fg1 ${sortedBy === 'old' ? 'text-fg1' : ''}`}
			>
				<IconTags stroke={2.35} class="h-4.5" />Tags
			</a>
		</div>
		{#each feed || [] as post (getId(post))}
			<PostBlock {...p} {nested} {post} depth={0} />
		{/each}
		<InfiniteLoading {identifier} spinner="spiral" on:infinite={loadMorePosts}>
			<p slot="noResults" class="m-2 text-xl text-fg2">
				<!-- TODO: noResults shows after deleting the one and only post then making another new post in Local  -->
				{feed?.length ? m.endOfFeed() : m.noPostsFound()}
			</p>
			<p slot="noMore" class="m-2 text-xl text-fg2">{m.endOfFeed()}</p>
			<p slot="error" class="m-2 text-xl text-fg2">
				{invalidUrl ? m.invalidUrl() : m.anErrorOccurred()}
			</p>
		</InfiniteLoading>
	{/if}
	{#if p.modal}
		<a
			href={`/l_l_${getSplitId(spotId).in_ms ?? ''}`}
			class="z-50 fixed xy right-1 bottom-1 h-9 w-9 bg-bg5 border-b-4 border-hl1 hover:bg-bg7 hover:border-hl2"
		>
			<IconX class="w-8" />
		</a>
	{:else if allowNewWriting}
		<button
			class="z-50 fixed xy right-1 text-black bottom-1 h-9 w-9 bg-hl1 hover:bg-hl2"
			onclick={() => (gs.writingNew = true)}
		>
			<IconPencilPlus class="h-9" />
		</button>
	{/if}
	<div class="flex-1"></div>
	<div
		class={`sticky bottom-0 z-50 ${gs.writingNew || gs.writingTo || gs.writingEdit ? '' : 'hidden'}`}
	>
		<PostWriter onSubmit={submitPost} />
	</div>
	{#if viewPostToastId}
		<a
			href={'/' + viewPostToastId}
			class="fx z-50 fixed h-10 pl-2 font-semibold bottom-2 self-center bg-bg5 hover:bg-bg7 border-b-4 border-hl1"
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
