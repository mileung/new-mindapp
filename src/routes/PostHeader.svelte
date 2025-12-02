<script lang="ts">
	import { dev } from '$app/environment';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { gs, spaceMsToSpaceName } from '$lib/global-state.svelte';
	import { copyToClipboard, identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs, minute } from '$lib/time';
	import { hasParent } from '$lib/types/parts';
	import { getAtIdStr, getFullIdObj, getIdStr, getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import { reactionList, type Post } from '$lib/types/posts';
	import { deletePost } from '$lib/types/posts/deletePost';
	import {
		IconBrowserMinus,
		IconBrowserShare,
		IconCaretLeft,
		IconCaretRight,
		IconCheck,
		IconCopy,
		IconCornerUpLeft,
		IconCube,
		IconCube3dSphere,
		IconDots,
		IconMoodPlus,
		IconPencil,
		IconShare2,
		IconSquarePlus2,
		IconTrash,
		IconX,
	} from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let p: {
		post: Post;
		parsed: boolean;
		bumpDownReactionHoverMenu: boolean;
		open: boolean;
		evenBg: boolean;
		onToggleParsed: () => void;
		lastVersion: null | number;
		version: null | number;
		onChangeVersion: (v: number) => void;
	} = $props();
	let moreOptionsOpen = $state(false);
	let strPostId = $derived(getIdStr(p.post));
	let versionMs = $derived(
		p.version === null || p.post.history === null ? null : p.post.history[p.version]?.ms,
	);

	let msLabel = $derived.by(() => {
		if (p.version === null) return formatMs(p.post.ms!);
		let str = formatMs(versionMs || 0, p.version < p.lastVersion!);
		let edited = Object.keys(p.post.history || {}).some((k) => +k > 0);
		return `${str}${edited ? '*' : ''}`;
	});
	let isoMsLabel = $derived.by(() => formatMs(versionMs || p.post.ms!, true));

	let copyClicked = $state(false);
	let handleCopyClick = () => {
		copyToClipboard(p.version === null ? '' : p.post.history?.[p.version]?.core || '');
		copyClicked = true;
		setTimeout(() => (copyClicked = false), 1000);
	};
	let deletable = $derived(p.lastVersion !== null || !p.post.subIds?.length);
	let savedLocally = $derived(true);
	let toggleSavedLocally = () => {
		return;
	};

	let xMoreOptionsBtn = $state<HTMLButtonElement>();
	let a = { onkeydown: (e: KeyboardEvent) => e.key === 'Escape' && (moreOptionsOpen = false) };
</script>

<div class="h-5 fx w-full">
	<div class="flex flex-1 overflow-scroll text-nowrap">
		<div class={`${p.open ? 'h-7' : 'h-5'} flex-1 flex text-sm font-bold text-fg2`}>
			<!-- {#if dev}<div class="fx mr-1">{strPostId}</div>{/if} -->
			<a
				href={'/' + strPostId}
				class="fx group hover:text-fg1"
				title={isoMsLabel}
				onclick={(e) => {
					if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
						e.preventDefault();
						pushState('/' + strPostId, { modalId: strPostId });
					}
				}}
			>
				<div class={`pr-1 ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
					{msLabel}
				</div>
			</a>
			<a
				href={`/_${p.post.by_ms}_${p.post.in_ms}`}
				class={`fx group hover:text-fg1 ${gs.idToPostMap[p.post.by_ms] ? '' : 'italic'}`}
				onclick={(e) => {
					// if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
					// 	e.preventDefault();
					// 	let accountInSpaceId = `/_${p.post.by_ms}_${p.post.in_ms}`;
					// 	pushState(
					// 		accountInSpaceId, //
					// 		{ modalId: accountInSpaceId },
					// 	);
					// }
				}}
			>
				<div class={`h-5 fx ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
					<AccountIcon ms={p.post.by_ms} class="mr-0.5 w-4 min-w-4" />
					<p class="pr-1">
						<!-- TODO: names for users -->
						<!-- {p.post.by_ms ? getAccountName(...) || identikana(p.post.by_ms) : m.anon()} -->
						{identikana(p.post.by_ms)}
					</p>
				</div>
			</a>
			{#if p.post.in_ms !== gs.currentSpaceMs}
				<a
					href={`/__${p.post.in_ms}`}
					class={`fx group hover:text-fg1 ${p.post.in_ms ? '' : 'italic'}`}
				>
					<div class={`h-5 fx ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
						<SpaceIcon ms={p.post.in_ms} class="mx-0.5 w-4 min-w-4" />
						<p class="pr-0.5">
							{spaceMsToSpaceName(p.post.in_ms)}
						</p>
					</div>
				</a>
			{/if}
			<button
				class="fx group hover:text-fg1"
				onmousedown={(e) => e.preventDefault()}
				onclick={() => {
					gs.writingNew = true;
					gs.writerCore = `${gs.writerCore}\n${strPostId}`;
				}}
			>
				<div class={`h-5 px-1.5 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
					<IconSquarePlus2 stroke={2.5} class="w-4" />
				</div>
			</button>
			<div class="flex-1 min-w-4 fx group hover:text-fg1">
				<button
					class="fx h-full flex-1"
					onclick={() => {
						gs.writingNew = gs.writingEdit = false;
						gs.writingTo = gs.writingTo && getIdStr(gs.writingTo) === strPostId ? false : p.post;
					}}
				>
					<div class={`h-5 fx w-full ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
						<IconCornerUpLeft class="w-5" />
					</div>
				</button>
				<div
					class={`absolute z-10 right-0 h-7 hidden group-hover:flex ${p.bumpDownReactionHoverMenu ? 'top-10' : 'top-5'} ${p.evenBg ? 'bg-bg1 group-hover:bg-bg4' : 'bg-bg2 group-hover:bg-bg5'}`}
				>
					{#each reactionList.slice(0, 4) as emoji}
						<button
							class="text-sm w-7 xy hover:bg-bg7 grayscale-75 hover:grayscale-0"
							onclick={() => {
								console.log(emoji);
							}}
						>
							{emoji}
						</button>
					{/each}
					<button
						class="hidden text-lg w-7 xy hover:bg-bg7 hover:text-fg3"
						onclick={() => {
							// console.log(emoji);
						}}
					>
						<IconMoodPlus class="w-4" />
					</button>
				</div>
			</div>
			{#if p.lastVersion && p.version !== null && p.lastVersion !== null}
				<div class="flex">
					<p class="self-center mx-0.5">({p.version}/{p.lastVersion})</p>
					<button
						class="fx relative overflow-clip group hover:text-fg1"
						onclick={() => p.onChangeVersion(Math.max(0, p.version! - 1))}
					>
						<div class={`xy h-5 w-6 ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							<IconCaretLeft class="w-5.5 translate-x-0.5" />
						</div>
					</button>
					<button
						class="fx relative overflow-clip group hover:text-fg1"
						onclick={() => p.onChangeVersion(Math.min(p.lastVersion!, p.version! + 1))}
					>
						<div class={`xy h-5 w-6 ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							<IconCaretRight class="w-5.5 -translate-x-0.5" />
						</div>
					</button>
				</div>
			{/if}
			{#if moreOptionsOpen}
				<button
					{...a}
					bind:this={xMoreOptionsBtn}
					class="xy group hover:text-fg1"
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
				<button
					{...a}
					class="fx group hover:text-fg1"
					onclick={() => {
						if (!navigator.share) return alert(m.webShareApiNotSupported());
						navigator
							.share({
								url: '/test',
								title: 'title',
								text: 'text',
							})
							.catch((err) => {
								// user cancelled or share failed
								if (err && err.name !== 'AbortError') {
									console.error('Share failed:', err);
								}
							});
					}}
				>
					<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
						<IconShare2 class="h-4 w-4" />
					</div>
				</button>
				{#if p.post.in_ms !== 0 && p.post.in_ms !== undefined}
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
					class={`${deletable ? '' : 'hidden'} fx group hover:text-fg1`}
					onclick={async () => {
						let ok =
							dev ||
							Date.now() - versionMs! < minute ||
							confirm(
								// p.lastVersion! > 0
								// ? m.areYouSureYouWantToDeleteThisVersion()
								// : m.areYouSureYouWantToDeleteThisPost(),
								m.areYouSureYouWantToDeleteThisPost(),
							);
						if (ok) {
							let useRpc = getIdStrAsIdObj(page.state.modalId || page.params.id || '').in_ms !== 0;
							let { soft } = await deletePost(getFullIdObj(p.post), null, useRpc);
							if (soft) {
								gs.idToPostMap[strPostId]!.history = null;
							} else {
								let parentPostIdStr = getAtIdStr(p.post);
								if (hasParent(p.post) && gs.idToPostMap[parentPostIdStr]?.subIds) {
									gs.idToPostMap[parentPostIdStr].subIds = [
										...gs.idToPostMap[parentPostIdStr].subIds.filter((id) => id !== strPostId),
									];
								}
								gs.idToPostMap[strPostId] = null;
							}
						}
					}}
				>
					<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
						<IconTrash class="w-4.5" />
					</div>
				</button>
				{#if p.lastVersion !== null}
					<!-- <button
							{...a}
							class="fx group hover:text-fg1"
							onclick={async () => {
								// TODO: delete current version if last version and no replies after version ms
								// TODO: soft delete current version if post has replies after version ms
								// TODO: Put this button behind a flag in settings since most ppl wouldn't use it and PostHeader is getting crowded
							}}
						>
							<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
								<IconBackspace class="w-4.5" />
							</div>
						</button> -->
					<button
						{...a}
						class="fx group hover:text-fg1"
						onclick={() => {
							gs.writingNew = gs.writingTo = false;
							gs.writingEdit =
								gs.writingEdit && getIdStr(gs.writingEdit) === strPostId ? false : p.post;
						}}
					>
						<div class={`h-5 w-6 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
							<IconPencil class="w-4.5" />
						</div>
					</button>
				{/if}
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
