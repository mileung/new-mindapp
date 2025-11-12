<script lang="ts">
	import { pushState } from '$app/navigation';
	import { textInputFocused } from '$lib/dom';
	import { gs } from '$lib/global-state.svelte';
	import { strIsInt } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags, updateLocalCache } from '$lib/types/local-cache';
	import {
		bracketRegex,
		getId,
		getToId,
		idsRegex,
		overwriteLocalPost,
		splitId,
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
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import Highlight from './Highlight.svelte';
	import PostBlock from './PostBlock.svelte';
	import PostWriter from './PostWriter.svelte';
	import { getCitedPostIds, getLastVersion, normalizeTags, type Post } from '$lib/types/posts';
	import { getPostFeed, rootPostsPerLoad } from '$lib/types/posts/getPostFeed';
	import { addPost } from '$lib/types/posts/addPost';
	import { dev } from '$app/environment';
	import { page } from '$app/state';

	let byMssRegex = /(^|\s)\/_\d*_\/($|\s)/g;
	let quoteRegex = /"([^"]+)"/g;
	let p: { hidden?: boolean; modal?: boolean; searchedText: string; idParam?: string } = $props();

	let viewPostToastId = $state('');
	let splitIdParam = $derived(splitId(p.idParam || ''));
	let inLocal = $derived(splitIdParam.in_ms === null);
	$effect(() => {
		if (gs.accounts) {
			localStorage.setItem('callerMs', '' + gs.accounts[0].ms);
		}
	});
	let makeFeedIdentifier = (callerMs: number | null, idParam: string, searchedText: string) => {
		return JSON.stringify({
			callerMs,
			idParam,
			searchedText,
		});
	};
	let localFeedId = makeFeedIdentifier(null, 'l_l_', '');
	let identifier = $derived(
		gs.accounts && p.idParam
			? makeFeedIdentifier(
					p.idParam !== 'l_l_' && p.idParam !== 'l_l_1' ? gs.accounts[0].ms : null,
					p.idParam,
					p.searchedText,
				)
			: '',
	);

	let nested = $derived(page.url.searchParams.get('linear') === null);
	let sortedBy = $derived.by<'updates' | 'new' | 'old'>(() => {
		let params = page.url.searchParams;
		let linear = params.get('linear') !== null;
		if (params.get('new') !== null) return 'new';
		if (params.get('old') !== null) return 'old';
		return linear ? 'new' : 'updates';
	});

	let spotId = $derived(p.idParam && p.idParam[0] !== 'l' ? p.idParam : '');
	let personalSpaceRequiresLogin = $derived(
		splitIdParam.in_ms === 0 && //
			gs.accounts?.[0].ms === null,
	);
	let allowNewWriting = $derived(!p.modal && !personalSpaceRequiresLogin);
	let timeGetPostFeed = dev;
	onMount(() => {
		if (timeGetPostFeed) gs.feeds = {};
		const handler = (e: KeyboardEvent) => {
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

	let scrollToHighlight = () => {
		let id = spotId || getId(gs.writingEdit || gs.writingTo || {});
		let e =
			document.querySelector('#m' + id) || //
			document.querySelector('.m' + id);
		e?.scrollIntoView({ block: 'start' });
	};

	let getTags = (input?: string) => {
		return (input?.match(bracketRegex) || []).map((match) => match.slice(1, -1));
	};

	let loadMorePosts = async (e: InfiniteEvent) => {
		// await new Promise((res) => setTimeout(res, 1000));
		// console.log(
		// 	'loadMorePosts:',
		// 	identifier,
		// 	// $state.snapshot(gs.feeds[identifier]),
		// 	// $state.snapshot(gs.posts),
		// );

		// TODO: load locally saved postIds and only fetch new ones if the user scrolls or interacts with the feed. This is to reduce unnecessary requests when the user just wants to add a post via the extension

		if (!gs.accounts || !identifier || !p.idParam || personalSpaceRequiresLogin) return;
		let lastPostId = (gs.feeds[identifier] || []).slice(-1)[0];
		if (lastPostId === null) return e.detail.complete();
		let feedPostIds = (gs.feeds[identifier] as string[]) || [];
		let lastPostMs = lastPostId ? splitId(lastPostId).ms! : null;
		let fromMs =
			lastPostMs || sortedBy === 'old' //
				? 0
				: Number.MAX_SAFE_INTEGER;
		// let mssInclude: ('' | number)[] = [ms === null ? '' : +ms];
		// let byMssInclude: ('' | number)[] = [by_ms === null ? '' : +by_ms];
		if (Number.isNaN(splitIdParam.in_ms)) throw new Error('Invalid in_ms');
		let inMssInclude = splitIdParam.in_ms === null ? [] : [splitIdParam.in_ms];
		// console.log('inMssInclude:', inMssInclude);

		let callerMs = gs.accounts[0].ms || undefined;
		let postFeed: Awaited<ReturnType<typeof getPostFeed>>;
		if (spotId) {
			postFeed = await getPostFeed({
				useRpc: !inLocal,
				callerMs,
				nested,
				inMssInclude,
				fromMs,
				idsInclude: [spotId],
			});
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
			let txtIncludes = [
				...quotes,
				...citedIds,
				...searchedTextNoTagsOrAuthors
					.replace(quoteRegex, ' ')
					.replace(idsRegex, ' ')
					.split(/\s+/g)
					.filter((a) => !!a)
					.map((s) => s.toLowerCase()),
			];

			let lastRootLatestIdsWithSameMs: string[] = [lastPostId];
			for (let i = feedPostIds.length - 2; i >= 0; i--) {
				let id = feedPostIds[i];
				if (splitId(id).ms === lastPostMs) {
					lastRootLatestIdsWithSameMs.push(id);
				} else break;
			}

			timeGetPostFeed && console.time('getPostFeed');
			postFeed = await getPostFeed({
				useRpc: !inLocal,
				callerMs,
				nested,
				fromMs,
				inMssInclude,
				byMssInclude,
				tagsInclude,
				txtIncludes,
				idsExclude: [...lastRootLatestIdsWithSameMs],
			});
			timeGetPostFeed && console.timeEnd('getPostFeed');
		}
		let { postIds, postMap } = postFeed;
		// console.log('postFeed:', postFeed);

		let postMapEntries = Object.entries(postMap);
		for (let i = 0; i < postMapEntries.length; i++) {
			let [id, post] = postMapEntries[i];
			postMap[id].subIds = postMap[id].subIds || [];
			// postMap[id].citeCount = postMap[id].citeCount || 0;
			// postMap[id].replyCount = postMap[id].replyCount || 0;
			let lastVersion = getLastVersion(postMap[id]);
			postMap[id].history[lastVersion].tags = postMap[id].history[lastVersion].tags || [];
			postMap[id].history[lastVersion].tags.sort();
			// postMap[id].reactCount = postMap[id].reactCount || 0;
			let toId = getToId(post);
			if (toId) {
				postMap[toId].subIds = postMap[toId].subIds || [];
				postMap[toId].subIds.push(id);
			}
		}
		for (let i = 0; i < postMapEntries.length; i++) {
			let [id] = postMapEntries[i];
			postMap[id].subIds!.sort((a, b) => splitId(b).ms! - splitId(a).ms!);
		}

		let endReached = postIds.length < rootPostsPerLoad;
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
			// await updateSavedTags({ adding: tags, removing: [] });
		}

		let post: Post;
		if (gs.writingEdit) {
			let postBeingEdited = gs.posts[getId(gs.writingEdit)]!;
			post = {
				...postBeingEdited,
				history: { ...postBeingEdited.history },
			};
			// let updateInCloud = async () => {
			// 	post.tags = await editPost(post, true);
			// 	await overwriteLocalPost(post);
			// };
			// if (inLocal) {
			// 	Number.isInteger(post.in_ms) ? updateInCloud() : (post.tags = await editPost(post, false));
			// } else updateInCloud();
		} else {
			post = {
				...(gs.writingTo
					? {
							to_ms: gs.writingTo.ms,
							to_by_ms: gs.writingTo.by_ms,
							to_in_ms: gs.writingTo.in_ms,
						}
					: {}),
				by_ms: gs.accounts[0].ms,
				in_ms: gs.currentSpaceMs,
				history: {
					0: {
						ms: -1,
						tags: normalizeTags(tags),
						body: body,
					},
				},
			};
			try {
				// console.log('post:', post);
				post.ms = (await addPost(post, !inLocal)).ms;
				post.subIds = [];
				// post.citeCount = 0;
				// post.replyCount = 0;
				// if (!inLocal) await addPost(post, false);
			} catch (error) {
				console.log(error);
				return alert(error);
			}
		}

		// let lastVersion = getLastVersion(post);
		// let currentCitedPostIds = getCitedPostIds(post.history[lastVersion].body || '');

		// TODO: inc/dec tag count

		// if (!lastVersion) {
		// 	for (let i = 0; i < currentCitedPostIds.length; i++) {
		// 		let postId = currentCitedPostIds[i];
		// 		gs.posts[postId]!.citeCount!++;
		// 	}
		// } else {
		// 	let previousCitedPostIds = getCitedPostIds(post.history[lastVersion - 1].body || '');
		// 	for (let i = 0; i < previousCitedPostIds.length; i++) {
		// 		let postId = previousCitedPostIds[i];
		// 		if (!currentCitedPostIds.includes(postId)) {
		// 			gs.posts[postId]!.citeCount!--;
		// 		}
		// 	}
		// 	for (let i = 0; i < currentCitedPostIds.length; i++) {
		// 		let postId = currentCitedPostIds[i];
		// 		if (!previousCitedPostIds.includes(postId)) {
		// 			gs.posts[postId]!.citeCount!++;
		// 		}
		// 	}
		// }

		let postId = getId(post);
		gs.posts = { ...gs.posts, [postId]: post };
		if (gs.writingTo) {
			let toPostId = getToId(post);
			nested && gs.posts[toPostId!]!.subIds!.unshift(postId);
			// gs.posts[toPostId!]!.replyCount!++;
		} else if (gs.writingNew) {
			gs.feeds = {
				...gs.feeds,
				[identifier]: [postId, ...gs.feeds[identifier]!],
				[localFeedId]: [postId, ...(gs.feeds[localFeedId]! || [])],
			};
		}
		if (gs.writingNew || gs.writingTo) {
			viewPostToastId = postId;
			setTimeout(() => (viewPostToastId = ''), 3000);
		}
		gs.writingNew = gs.writingTo = gs.writingEdit = false;
	};

	let makeParams = (newNested: boolean, newSortedBy: 'updates' | 'new' | 'old') => {
		let view = newNested ? '' : 'linear';
		if (!newNested && newSortedBy === 'updates') newSortedBy = 'new';
		if (!nested && newNested && newSortedBy === 'new') newSortedBy = 'updates';
		let s = newNested
			? newSortedBy === 'updates'
				? ''
				: newSortedBy //
			: newSortedBy === 'new'
				? ''
				: newSortedBy;
		let queryParams = `?${view}${view && s ? '&' : ''}${s}`;
		return queryParams === '?' ? page.url.pathname : queryParams;
	};

	let feed = $derived(
		gs.feeds[identifier]?.map((postId) => gs.posts[postId || 0]).filter((t) => !!t),
	);

	let scrolledToSpotId = $state(false);
	$effect(() => {
		if (p.idParam && !scrolledToSpotId && feed?.length) {
			setTimeout(() => scrollToHighlight(), 0);
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
	{:else if p.idParam === 'l_l_' && !p.searchedText && feed && !feed.length}
		welcome
	{:else}
		<div class="flex min-h-9 text-fg2">
			<a
				href={makeParams(true, sortedBy)}
				class={`fx pr-1.5 hover:text-fg1 ${nested ? 'text-fg1' : ''}`}
			>
				<IconListTree stroke={2.5} class="h-4" />Nested
			</a>
			<a
				href={makeParams(false, sortedBy)}
				class={`fx pr-1.5 hover:text-fg1 ${!nested ? 'text-fg1' : ''}`}
			>
				<IconList stroke={2.5} class="h-4" />Linear
			</a>
			<div class="xy mr-0.5">
				<IconSquareFilled class="h-1.5 w-1.5" />
			</div>
			<a
				href={makeParams(nested, 'updates')}
				class={`${nested ? '' : 'inv isible'} relative fx pr-1.5 hover:text-fg1 ${sortedBy === 'updates' || (sortedBy === 'new' && !nested) ? 'text-fg1' : ''}`}
			>
				<IconMessage2Up stroke={2.5} class="h-4" />
				Updates
			</a>
			<a
				href={makeParams(nested, 'new')}
				class={`fx pr-1.5 hover:text-fg1 ${sortedBy === 'new' ? 'text-fg1' : ''}`}
			>
				<IconClockUp stroke={2.5} class="h-4" />New
			</a>
			<a
				href={makeParams(nested, 'old')}
				class={`fx pr-1.5 hover:text-fg1 ${sortedBy === 'old' ? 'text-fg1' : ''}`}
			>
				<IconArchive stroke={2.5} class="h-4" />Old
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
			<p slot="error" class="m-2 text-xl text-fg2">{m.anErrorOccurred()}</p>
		</InfiniteLoading>
	{/if}
	{#if p.modal}
		<a
			href={`/l_l_${splitId(spotId).in_ms}`}
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

	{#if gs.writingNew || gs.writingTo || gs.writingEdit}
		<div class="flex-1"></div>
		<div class="sticky bottom-0 z-50">
			<div class="flex group bg-bg4 relative w-full">
				<!-- TODO: save writer data so it persists after page refresh. If the post it's editing or linking to is not on the feed, open it in a modal? -->
				<button class="truncate flex-1 h-8 pl-2 text-left fx gap-1" onclick={scrollToHighlight}>
					{#if gs.writingTo}
						<IconCornerUpLeft class="w-5" />
					{:else if gs.writingNew}
						<IconPencilPlus class="w-5" />
					{:else}
						<IconPencil class="w-5" />
					{/if}
					<p class="flex-1 truncate">
						{gs.writingNew
							? m.newPost()
							: gs.posts[
									gs.writingTo ? getId(gs.writingTo) : gs.writingEdit ? getId(gs.writingEdit) : ''
									// TODO: get latest revision
								]!.history[0].body}
					</p>
				</button>
				<button
					class="w-8 xy text-fg2 hover:bg-bg5 hover:text-fg1"
					onclick={() => (gs.writingNew = gs.writingTo = gs.writingEdit = false)}
				>
					<IconX class="w-5" />
				</button>
				<Highlight
					id={gs.writingTo ? getId(gs.writingTo) : gs.writingEdit ? getId(gs.writingEdit) : ''}
				/>
			</div>
			<PostWriter onSubmit={submitPost} />
		</div>
	{/if}
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
