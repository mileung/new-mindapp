<script lang="ts">
	import { dev } from '$app/environment';
	import { pushState } from '$app/navigation';
	import { gs } from '$lib/global-state.svelte';
	import { copyToClipboard, identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs, minute } from '$lib/time';
	import { getId, splitId, type PartInsert } from '$lib/types/parts';
	import {
		IconCheck,
		IconCornerUpLeft,
		IconDots,
		IconSquarePlus2,
		IconPencil,
		IconTrash,
		IconX,
		IconCaretLeft,
		IconCaretRight,
		IconCube,
		IconCube3dSphere,
		IconBookmark,
		IconBookmarkFilled,
		IconCopy,
		IconBrowserMinus,
		IconBrowserShare,
	} from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';
	import type { Post } from '$lib/types/posts';
	import { page } from '$app/state';
	import { deletePost } from '$lib/types/posts/deletePost';

	let xBtn = $state<HTMLButtonElement>();
	let trashBtn = $state<HTMLButtonElement>();
	let pencilBtn = $state<HTMLButtonElement>();
	let fingerprintClicked = $state(false);
	let copyClicked = $state(false);

	let p: {
		post: Post;
		parsed: boolean;
		onToggleParsed: () => void;
		latestVersion: number;
		version: number;
		onChangeVersion: (v: number) => void;
	} = $props();
	let moreOptionsOpen = $state(false);
	let currentHistoryIndex = $state(0);
	let postId = $derived(getId(p.post));
	let { ms: postMs, by_ms: postByMs, in_ms: postInMs } = $derived(splitId(postId));
	let when = $derived(formatMs(postMs || 0));
	let edited = $derived(Object.keys(p.post.history).some((k) => +k > 0));
	// let { authorTags, systemTags } = $derived((p.post.tags));
	let currentHistoryTags = $derived(p.post.history[currentHistoryIndex].tags || []);
	// let editMs = $derived.by(() => {
	// 	let editedTag = systemTags.find((t) => t.startsWith(' edited:'));
	// 	let editMs = editedTag ? +editedTag.slice(8) : null;
	// 	return editMs;
	// });

	let savedLocally = $derived(true);
	let toggleSavedLocally = () => {
		return;
	};

	let whenVerbose = $derived(
		// `${formatMs(postMs || 0, true)}${editMs ? ' - ' + formatMs(editMs, true) : ''}`,
		'TODO',
	);

	let handleCopyClick = () => {
		copyToClipboard(p.post.history['' + currentHistoryIndex].body || '');
		copyClicked = true;
		setTimeout(() => (copyClicked = false), 1000);
	};
</script>

<div class="fx h-5 text-sm font-bold text-fg2">
	<!-- {#if dev}<p class="truncate mr-1">{postId}</p>{/if} -->
	<a
		href={'/' + postId}
		title={whenVerbose}
		class={`truncate pr-1 hover:text-fg1 h-7 xy`}
		onclick={(e) => {
			if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
				e.preventDefault();
				pushState('/' + postId, { modalId: postId });
			}
		}}
	>
		<p class="truncate">
			{when}{edited ? ' *' : ''}
		</p>
	</a>
	<a
		href={`/l_${postByMs ?? ''}_${postInMs ?? ''}`}
		class={`truncate h-7 pr-1 fx hover:text-fg1 ${gs.posts[postByMs ?? ''] ? '' : 'italic'}`}
		onclick={(e) => {
			if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
				e.preventDefault();
				let accountInSpaceId = `/l_${postByMs ?? ''}_${postInMs ?? ''}`;
				pushState(
					accountInSpaceId, //
					{ modalId: accountInSpaceId },
				);
			}
		}}
	>
		<AccountIcon ms={postByMs} class="mr-0.5 min-h-4 min-w-4 max-h-4 max-w-4" />
		<!-- TODO: names for users -->
		<p class="truncate">
			<!-- {postByMs ? getAccountName(...) || identikana(postByMs) : m.anon()} -->
			{postByMs ? identikana(postByMs) : m.anon()}
		</p>
	</a>
	<a
		href={`/l_l_${postInMs ?? ''}`}
		class={`truncate h-7 pr-1 fx gap-1 hover:text-fg1 ${postInMs ? '' : 'italic'}`}
	>
		<SpaceIcon ms={postInMs} class="min-h-4 min-w-4 max-h-4 max-w-4" />
		<p class={`truncate ${gs.posts[postInMs || ''] ? '' : 'italic'}`}>
			{postInMs === 0
				? m.personal()
				: postInMs === 1
					? m.global()
					: postInMs
						? gs.spaces[postInMs]?.ms
						: m.local()}
		</p>
	</a>
	<button
		class="fx h-7 pl-1 pr-1.5 xy hover:text-fg1"
		onmousedown={(e) => e.preventDefault()}
		onclick={() => {
			gs.writingNew = true;
			gs.writerBody = `${gs.writerBody}\n${postId}`;
		}}
	>
		<IconSquarePlus2 stroke={2.5} class="h-4 w-4" />
		<!-- <p class="ml-1">{p.post.citeCount}</p> -->
	</button>
	<div class="flex-1 h-4 fx">
		<button
			class="flex-1 min-w-4 h-7 fx hover:text-fg1"
			onclick={() => {
				gs.writingNew = gs.writingEdit = false;
				gs.writingTo = gs.writingTo && getId(gs.writingTo) === postId ? false : p.post;
			}}
		>
			<IconCornerUpLeft class="w-5" />
			<!-- <p class="ml-0.5">{p.post.replyCount}</p> -->
		</button>
		{#if p.latestVersion}
			<div class="truncate fx ml-2">
				<p class="truncate mx-0.5">({currentHistoryIndex}/{10})</p>
				<button class="xy relative overflow-hidden h-7 w-4 hover:text-fg1">
					<IconCaretLeft class="absolute h-5.5" />
				</button>
				<button class="xy relative overflow-hidden h-7 w-4 hover:text-fg1">
					<IconCaretRight class="absolute h-5.5" />
				</button>
			</div>
		{/if}
		<div class="">
			{#if moreOptionsOpen}
				<div class="fx">
					<button
						bind:this={xBtn}
						class="h-7 w-6 xy hover:text-fg1"
						onclick={() => (moreOptionsOpen = false)}
						onkeydown={(e) => e.key === 'Escape' && (moreOptionsOpen = false)}
					>
						<IconX class="w-5" />
					</button>
					<button class="h-7 w-6 xy hover:text-fg1" onclick={p.onToggleParsed}>
						{#if p.parsed}
							<IconCube class="h-4 w-4" />
						{:else}
							<IconCube3dSphere class="h-4 w-4" />
						{/if}
					</button>
					<button class="h-7 w-6 xy hover:text-fg1" onclick={handleCopyClick}>
						{#if copyClicked}
							<IconCheck class="h-4.5 w-4.5" />
						{:else}
							<IconCopy class="h-4 w-4" />
						{/if}
					</button>
					{#if p.post.in_ms !== null && p.post.in_ms !== undefined}
						<button class="h-7 w-6 xy hover:text-fg1" onclick={toggleSavedLocally}>
							{#if savedLocally}
								<IconBrowserMinus class="h-4.5 w-4.5" />
							{:else}
								<IconBrowserShare class="h-4 w-4" />
							{/if}
						</button>
					{/if}
					<button
						bind:this={trashBtn}
						class="h-7 w-6 xy hover:text-fg1"
						onclick={async () => {
							let ok =
								dev ||
								Date.now() - postMs! < minute ||
								confirm(
									p.latestVersion > 0
										? m.areYouSureYouWantToDeleteThisVersion()
										: m.areYouSureYouWantToDeleteThisPost(),
								);
							if (ok) {
								let useRpc = splitId(page.state.modalId || page.params.id || '').in_ms !== null;
								let { soft } = await deletePost(postId, useRpc);
								// gs.posts[postId] = soft
								// 	? {
								// 			...gs.posts[postId],
								// 			txt: null,
								// 			tags: [' deleted'],
								// 		}
								// 	: null;
							}
						}}
						onkeydown={(e) => e.key === 'Escape' && (moreOptionsOpen = false)}
					>
						<IconTrash class="w-4.5" />
					</button>
					<button
						bind:this={pencilBtn}
						class="h-7 w-6 xy hover:text-fg1"
						onclick={() => {
							gs.writingNew = gs.writingTo = false;
							gs.writingEdit = gs.writingEdit && getId(gs.writingEdit) === postId ? false : p.post;
						}}
						onkeydown={(e) => e.key === 'Escape' && (moreOptionsOpen = false)}
					>
						<IconPencil class="w-4.5" />
					</button>
				</div>
			{:else}
				<button class="h-7 w-6 xy hover:text-fg1" onclick={() => (moreOptionsOpen = true)}>
					<IconDots stroke={3} class="w-4" />
				</button>
			{/if}
		</div>
	</div>
</div>
{#if currentHistoryTags.length}
	<div class="overflow-hidden">
		<div class="-mx-1 flex flex-wrap mini-scroll max-h-18">
			{#each currentHistoryTags as tag}
				<!-- TODO: Why does using leading-4 cause parent to scroll? -->
				<a
					href={`/l_l_${gs.currentSpaceMs}?q=${encodeURIComponent(`[${tag}]`)}`}
					class="font-bold text-fg2 px-1 leading-5 hover:text-fg1"
				>
					{tag}
				</a>
			{/each}
		</div>
	</div>
{/if}
