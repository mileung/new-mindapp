<script lang="ts">
	import { dev } from '$app/environment';
	import { pushState } from '$app/navigation';
	import { gs } from '$lib/global-state.svelte';
	import { copyToClipboard, identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs, minute } from '$lib/time';
	import { getId, getSplitIdToSplitId, getSplitId, type PartInsert } from '$lib/types/parts';
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
	import { getPostHistory } from '$lib/types/posts/getPostHistory';
	import { onMount } from 'svelte';

	let p: {
		post: Post;
		parsed: boolean;
		open: boolean;
		evenBg: boolean;
		onToggleParsed: () => void;
		lastVersion: number;
		version: number;
		onChangeVersion: (v: number) => void;
	} = $props();
	let moreOptionsOpen = $state(false);
	let postId = $derived(getId(p.post));
	let { ms: postMs, by_ms: postByMs, in_ms: postInMs } = $derived(getSplitId(postId));
	let versionMs = $derived(
		p.post.history === null //
			? null
			: p.post.history[p.version]?.ms,
	);

	let msLabel = $derived.by(() => {
		let str = formatMs(versionMs || 0, p.version < p.lastVersion);
		let edited = Object.keys(p.post.history || {}).some((k) => +k > 0);
		return `${str}${edited ? '*' : ''}`;
	});

	let copyClicked = $state(false);
	let handleCopyClick = () => {
		copyToClipboard(p.post.history?.[p.version]?.body || '');
		copyClicked = true;
		setTimeout(() => (copyClicked = false), 1000);
	};

	let savedLocally = $derived(true);
	let toggleSavedLocally = () => {
		return;
	};

	let xMoreOptionsBtn = $state<HTMLButtonElement>();
	let a = { onkeydown: (e: KeyboardEvent) => e.key === 'Escape' && (moreOptionsOpen = false) };
</script>

<div class="h-5 fx">
	<div class={`truncate ${p.open ? 'h-7' : 'h-5'} flex-1 flex text-sm font-bold text-fg2`}>
		<!-- {#if dev}<p class="truncate mr-1">{postId}</p>{/if} -->
		<a
			href={'/' + postId}
			class="fx truncate group hover:text-fg1"
			onclick={(e) => {
				if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
					e.preventDefault();
					pushState('/' + postId, { modalId: postId });
				}
			}}
		>
			<div class={`truncate pr-1 ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
				<p class="truncate">
					<!-- {when}{edited ? ' *' : ''} -->
					{msLabel}
				</p>
			</div>
		</a>
		<a
			href={`/l_${postByMs ?? ''}_${postInMs ?? ''}`}
			class={`truncate fx group hover:text-fg1 ${gs.posts[postByMs ?? ''] ? '' : 'italic'}`}
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
			<div class={`truncate h-5 pr-1 fx ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
				<AccountIcon ms={postByMs} class="mr-0.5 w-4 min-w-4" />
				<!-- TODO: names for users -->
				<p class="truncate">
					<!-- {postByMs ? getAccountName(...) || identikana(postByMs) : m.anon()} -->
					{postByMs ? identikana(postByMs) : m.anon()}
				</p>
			</div>
		</a>
		<a
			href={`/l_l_${postInMs ?? ''}`}
			class={`truncate fx group hover:text-fg1 ${postInMs ? '' : 'italic'}`}
		>
			<div
				class={`truncate h-5 gap-1 pr-1 fx ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}
			>
				<SpaceIcon ms={postInMs} class="w-4 min-w-4" />
				<p class={`truncate ${gs.posts[postInMs || ''] ? '' : 'italic'}`}>
					{postInMs === 0
						? m.personal()
						: postInMs === 1
							? m.global()
							: postInMs
								? gs.spaces[postInMs]?.ms
								: m.local()}
				</p>
			</div>
		</a>
		<button
			class="fx group hover:text-fg1"
			onmousedown={(e) => e.preventDefault()}
			onclick={() => {
				gs.writingNew = true;
				gs.writerBody = `${gs.writerBody}\n${postId}`;
			}}
		>
			<div class={`h-5 pl-1 pr-1.5 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
				<IconSquarePlus2 stroke={2.5} class="w-4" />
			</div>
		</button>
		<div class={`truncate ${p.lastVersion ? 'min-w-22' : ''} flex-1 flex`}>
			<button
				class="flex-1 min-w-4 fx group hover:text-fg1"
				onclick={() => {
					gs.writingNew = gs.writingEdit = false;
					gs.writingTo = gs.writingTo && getId(gs.writingTo) === postId ? false : p.post;
				}}
			>
				<div class={`h-5 fx w-full ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
					<IconCornerUpLeft class="w-5" />
				</div>
			</button>
			{#if p.lastVersion}
				<div class="truncate flex">
					<p class="self-center truncate mx-0.5">({p.version}/{p.lastVersion})</p>
					<button
						class="fx relative overflow-clip group hover:text-fg1"
						onclick={() => p.onChangeVersion(Math.max(0, p.version - 1))}
					>
						<div class={`xy h-5 w-6 ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							<IconCaretLeft class="w-5.5 translate-x-0.5" />
						</div>
					</button>
					<button
						class="fx relative overflow-clip group hover:text-fg1"
						onclick={() => p.onChangeVersion(Math.min(p.lastVersion, p.version + 1))}
					>
						<div class={`xy h-5 w-6 ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							<IconCaretRight class="w-5.5 -translate-x-0.5" />
						</div>
					</button>
				</div>
			{/if}
			{#if moreOptionsOpen}
				<div class="flex">
					<button
						{...a}
						bind:this={xMoreOptionsBtn}
						class="fx group hover:text-fg1"
						onclick={() => (moreOptionsOpen = false)}
					>
						<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							<IconX class="w-5" />
						</div>
					</button>
					<button {...a} class="fx group hover:text-fg1" onclick={p.onToggleParsed}>
						<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							{#if p.parsed}
								<IconCube class="h-4 w-4" />
							{:else}
								<IconCube3dSphere class="h-4 w-4" />
							{/if}
						</div>
					</button>
					<button {...a} class="fx group hover:text-fg1" onclick={handleCopyClick}>
						<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							{#if copyClicked}
								<IconCheck class="h-4.5 w-4.5" />
							{:else}
								<IconCopy class="h-4 w-4" />
							{/if}
						</div>
					</button>
					{#if p.post.in_ms !== null && p.post.in_ms !== undefined}
						<button {...a} class="fx group hover:text-fg1" onclick={toggleSavedLocally}>
							<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
								{#if savedLocally}
									<IconBrowserMinus class="h-4.5 w-4.5" />
								{:else}
									<IconBrowserShare class="h-4 w-4" />
								{/if}
							</div>
						</button>
					{/if}
					<button
						{...a}
						class="fx group hover:text-fg1"
						onclick={async () => {
							let ok =
								dev ||
								Date.now() - versionMs! < minute ||
								confirm(
									p.lastVersion > 0
										? m.areYouSureYouWantToDeleteThisVersion()
										: m.areYouSureYouWantToDeleteThisPost(),
								);
							if (ok) {
								let useRpc = getSplitId(page.state.modalId || page.params.id || '').in_ms !== null;
								// let { soft } = await deletePost(getSplitIdToSplitId(p.post), p.version, useRpc);
								// gs.posts[postId] = soft
								// 	? {
								// 			...gs.posts[postId],
								// 			txt: null,
								// 			tags: [' deleted'],
								// 		}
								// 	: null;
							}
						}}
					>
						<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							<IconTrash class="w-4.5" />
						</div>
					</button>
					<button
						{...a}
						class="fx group hover:text-fg1"
						onclick={() => {
							gs.writingNew = gs.writingTo = false;
							gs.writingEdit = gs.writingEdit && getId(gs.writingEdit) === postId ? false : p.post;
						}}
					>
						<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							<IconPencil class="w-4.5" />
						</div>
					</button>
				</div>
			{:else}
				<button
					class="fx group hover:text-fg1"
					onclick={() => {
						moreOptionsOpen = true;
						setTimeout(() => xMoreOptionsBtn?.focus(), 0);
					}}
				>
					<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
						<IconDots stroke={3} class="w-4" />
					</div>
				</button>
			{/if}
		</div>
	</div>
</div>
