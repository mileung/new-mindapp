<script lang="ts">
	import { dev } from '$app/environment';
	import { gs, resetBottomOverlay } from '$lib/global-state.svelte';
	import { copyToClipboard } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs, minute } from '$lib/time';
	import { msToAccountNameTxt } from '$lib/types/accounts';
	import { hasParent } from '$lib/types/parts';
	import { getAtIdStr, getFullIdObj, getIdObjAsAtIdObj, getIdStr } from '$lib/types/parts/partIds';
	import type { Post } from '$lib/types/posts';
	import { deletePost } from '$lib/types/posts/deletePost';
	import { reactionList } from '$lib/types/reactions/reactionList';
	import { toggleReaction } from '$lib/types/reactions/toggleReaction';
	import { spaceMsToNameTxt } from '$lib/types/spaces';
	import {
		IconBrowserMinus,
		IconBrowserShare,
		IconCaretLeft,
		IconCaretRight,
		IconCheck,
		IconCopy,
		IconCornerUpLeft,
		IconCrownFilled,
		IconCube,
		IconCube3dSphere,
		IconDots,
		IconMoodPlus,
		IconPencil,
		IconShare2,
		IconShieldFilled,
		IconSquarePlus2,
		IconTrash,
		IconX,
	} from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import Apush from './Apush.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let p: {
		post: Post;
		parsed: boolean;
		bumpDownReactionHoverMenu: boolean;
		open: boolean;
		evenBg: boolean;
		onToggleParsed: () => void;
		lastVersion: number;
		version: number;
		onChangeVersion: (v: number) => void;
	} = $props();
	let moreOptionsOpen = $state(false);
	let postIdStr = $derived(getIdStr(p.post));
	let versionMs = $derived(
		p.version === null || p.post.history === null ? null : p.post.history[p.version]?.ms,
	);

	let msLabel = $derived.by(() => {
		if (p.version === null) return formatMs(p.post.ms!);
		let str = formatMs(versionMs || 0, p.version < p.lastVersion! ? 'ms' : '');
		let edited = Object.keys(p.post.history || {}).some((k) => +k > 1);
		return `${str}${edited ? '*' : ''}`;
	});
	let isoMsLabel = $derived.by(() => formatMs(versionMs || p.post.ms!, 'ms'));

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

<div class="group/div h-5 fx w-full">
	<div class="fx flex-1 overflow-scroll text-nowrap">
		<div class={`${p.open ? 'h-7' : 'h-5'} flex-1 flex text-sm font-bold text-fg2`}>
			<Apush href={'/' + postIdStr} class="fx group hover:text-fg1" title={isoMsLabel}>
				<div class={`pr-1 ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
					{msLabel}
				</div>
			</Apush>
			<Apush
				href={`/_${p.post.by_ms}_${p.post.in_ms}`}
				class={`fx group text-fg1 hover:text-fg3 ${gs.msToAccountNameTxtMap[p.post.by_ms] ? '' : 'italic'}`}
			>
				<div class={`h-5 fx ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
					{#if gs.spaceMsToMapOwnerAccountMs[p.post.in_ms]?.[p.post.by_ms]}
						<IconCrownFilled class="w-4" />
					{:else if gs.spaceMsToMapModAccountMs[p.post.in_ms]?.[p.post.by_ms]}
						<IconShieldFilled class="w-4" />
					{/if}
					<AccountIcon ms={p.post.by_ms} class="mx-0.5 shrink-0 w-4" />
					<p class="pr-1">
						{msToAccountNameTxt(p.post.by_ms)}
					</p>
				</div>
			</Apush>
			{#if p.post.in_ms !== gs.currentSpaceMs}
				<Apush
					href={`/__${p.post.in_ms}`}
					class={`fx group hover:text-fg1 ${gs.msToSpaceNameTxtMap[p.post.in_ms] ? '' : 'italic'}`}
				>
					<div class={`h-5 fx ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
						<SpaceIcon ms={p.post.in_ms} class="mx-0.5 shrink-0 w-4" />
						<p class="pr-0.5">
							{spaceMsToNameTxt(p.post.in_ms)}
						</p>
					</div>
				</Apush>
			{/if}
			<button
				class="fx group hover:text-fg1"
				onmousedown={(e) => e.preventDefault()}
				onclick={() => {
					gs.writingNew = true;
					gs.writerCore = `${gs.writerCore}\n${postIdStr}`;
				}}
			>
				<div class={`h-5 px-1.5 xy ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
					<IconSquarePlus2 stroke={2.5} class="w-4" />
				</div>
			</button>
			<div class="flex-1 shrink-0 w-4 fx group hover:text-fg1">
				<button
					class="fx h-full flex-1"
					onclick={() => {
						resetBottomOverlay('wt');
						gs.writingTo = gs.writingTo && getIdStr(gs.writingTo) === postIdStr ? null : p.post;
					}}
				>
					<div class={`h-5 fx w-full ${p.evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}>
						<IconCornerUpLeft class="w-5" />
					</div>
				</button>
				<div
					class={`absolute z-10 right-0 h-7 hidden group-hover/div:flex ${p.bumpDownReactionHoverMenu ? 'top-10' : 'top-5'} ${p.evenBg ? 'bg-bg1 group-hover/div:bg-bg4' : 'bg-bg2 group-hover/div:bg-bg5'}`}
				>
					{#each reactionList.slice(0, 4) as emoji}
						<button
							class="text-sm w-7 xy hover:bg-bg7 hover:text-fg3 grayscale-75 hover:grayscale-0"
							onclick={async () => {
								await toggleReaction({
									...getIdObjAsAtIdObj(p.post),
									ms: 0,
									by_ms: gs.accounts![0].ms,
									in_ms: gs.currentSpaceMs!,
									emoji,
								});
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
			{#if p.lastVersion > 1 && p.version}
				<div class="flex">
					<p class="self-center mx-0.5">({p.version}/{p.lastVersion})</p>
					<button
						class="fx relative overflow-clip group hover:text-fg1"
						onclick={() => p.onChangeVersion(Math.max(1, p.version! - 1))}
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
							let { soft } = await deletePost(getFullIdObj(p.post), null);
							console.log('soft:', soft);
							if (soft) gs.idToPostMap[postIdStr]!.history = null;
							else {
								let parentPostIdStr = getAtIdStr(p.post);
								if (hasParent(p.post) && gs.idToPostMap[parentPostIdStr]?.subIds) {
									gs.idToPostMap[parentPostIdStr].subIds = [
										...gs.idToPostMap[parentPostIdStr].subIds.filter((id) => id !== postIdStr),
									];
								}
								gs.idToPostMap[postIdStr] = null;
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
							gs.showReactionHistory = gs.writingNew = gs.writingTo = null;
							gs.writingEdit =
								gs.writingEdit && getIdStr(gs.writingEdit) === postIdStr ? null : p.post;
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
		{#if dev}{postIdStr}{/if}
	</div>
</div>
