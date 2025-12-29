<script lang="ts">
	import { gs, resetBottomOverlay } from '$lib/global-state.svelte';
	import { identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { hasParent } from '$lib/types/parts';
	import { getAtIdStr, getFullIdObj, getIdObjAsAtIdObj, getIdStr } from '$lib/types/parts/partIds';
	import { getLastVersion, type Post } from '$lib/types/posts';
	import { getPostHistory } from '$lib/types/posts/getPostHistory';
	import type { RxnEmoji } from '$lib/types/reactions';
	import { toggleReaction } from '$lib/types/reactions/toggleReaction';
	import { IconChartBarPopular, IconCornerUpLeft, IconMinus, IconPlus } from '@tabler/icons-svelte';
	import Apush from './Apush.svelte';
	import CoreParser from './CoreParser.svelte';
	import Highlight from './Highlight.svelte';
	import Self from './PostBlock.svelte';
	import PostHeader from './PostHeader.svelte';

	let p: {
		post: Post;
		nested?: boolean;
		cited?: boolean;
		depth: number;
		boldTags?: string[];
		boldCore?: string[];
	} = $props();
	let container: HTMLDivElement;
	let open = $state(true);
	let parsed = $state(true);
	let postIdStr = $derived(getIdStr(p.post));
	let evenBg = $derived(!(p.depth % 2));
	let atPostIdStr = $derived(getAtIdStr(p.post));
	let atPost = $derived(gs.idToPostMap[atPostIdStr]);
	let atPostDeleted = $derived(atPost?.history === null);
	let deleted = $derived(p.post.history === null);
	let atPostTxt = $derived.by(() => {
		if (atPost) {
			if (atPostDeleted) return m.deleted();
			return atPost.history![getLastVersion(atPost)!]!.core;
		}
	});
	let lastVersion = $derived(getLastVersion(p.post));
	let version = $state((() => lastVersion)());
	let layer = $derived(version === null ? null : p.post.history?.[version]);
	let core = $derived(layer?.core);
	let tags = $derived(layer?.tags);
	let rxnCountEntries = $derived(
		Object.entries(p.post.rxnCount || {}).sort(([, a], [, b]) => b - a) as [RxnEmoji, number][],
	);
	let changeVersion = async (v: number) => {
		if (!p.post.history?.[v]) {
			let { history } = await getPostHistory(getFullIdObj(p.post), v);
			if (!history) return;
			Object.keys(history).forEach((key) => history[key]?.tags?.sort());
			gs.idToPostMap[postIdStr] = {
				...gs.idToPostMap[postIdStr]!,
				history: {
					...gs.idToPostMap[postIdStr]!.history,
					...history,
				},
			};
		}
		// TODO: show loader?
		version = v;
	};

	let oldLastVersion = (() => lastVersion)();
	$effect(() => {
		if (oldLastVersion !== lastVersion) {
			changeVersion(lastVersion);
			oldLastVersion = lastVersion;
		}
	});
</script>

<div
	bind:this={container}
	class={`flex ${
		p.cited //
			? `cited-hlc-${postIdStr}`
			: `hlc-${postIdStr} ${p.nested || !atPostIdStr ? '' : `flat-at-hlc-${atPostIdStr}`}`
	} ${evenBg ? 'bg-bg1' : 'bg-bg2'}`}
>
	{#if !p.cited}
		<button
			class={`z-40 w-5 fy bg-inherit text-fg2 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
			onclick={() => {
				let distanceFromTop = container.getBoundingClientRect().top;
				let willBeOpen = !open;
				if (!willBeOpen && distanceFromTop < 0) container.scrollIntoView({ block: 'start' });
				open = willBeOpen;
			}}
		>
			<div class={`z-0 sticky bg-inherit h-5 w-5 xy ${!!gs.pendingInvite ? 'top-9' : 'top-0'}`}>
				{#if open}
					<IconMinus stroke={2.5} class="w-4" />
				{:else}
					<IconPlus stroke={2.5} class="w-4" />
				{/if}
			</div>
		</button>
	{/if}
	<div class={`bg-inherit flex-1 ${p.cited ? 'max-w-full' : 'max-w-[calc(100%-1.25rem)]'}`}>
		<div class={`relative bg-inherit`}>
			<div
				class={`z-10 bg-inherit ${p.cited ? '' : `sticky ${!!gs.pendingInvite ? 'top-9' : 'top-0'}`}`}
			>
				{#if open && !p.nested && !p.cited && atPost}
					<div class="relative flex h-5 text-sm">
						<Apush href={`/_${atPost.by_ms}_${atPost.in_ms}`} class={`fx group hover:text-fg1`}>
							<div
								class={`pl-2 pr-0.5 h-5 fx ${evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}
							>
								<!-- TODO: text color matches UserIcon -->
								<p class={`font-bold ${gs.idToPostMap[atPost.by_ms] ? '' : 'italic'}`}>
									<!-- TODO: names for users -->
									<!-- {atPost.by_ms ? accountMsToName(...) || identikana(atPost.by_ms) : m.anon()} -->
									{identikana(atPost.by_ms)}
								</p>
							</div>
						</Apush>
						<Apush
							href={'/' + getIdStr(atPost)}
							class={`fx hover:text-fg3 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
						>
							<p class={`mr-1 ${atPostDeleted ? 'text-fg2 font-bold italic text-xs' : ''}`}>
								: {atPostTxt}
							</p>
						</Apush>
						<button
							class={`flex-1 fx text-fg2 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
							onclick={() => {
								resetBottomOverlay('wt');
								gs.writingTo =
									gs.writingTo && getIdStr(gs.writingTo) === atPostIdStr ? null : atPost;
							}}
						>
							<IconCornerUpLeft class="w-5" />
						</button>
						<Highlight reply {evenBg} postIdStr={atPostIdStr} />
					</div>
				{/if}
				<PostHeader
					{...p}
					{open}
					{evenBg}
					{parsed}
					{version}
					{lastVersion}
					onToggleParsed={() => (parsed = !parsed)}
					bumpDownReactionHoverMenu={!p.nested && !!atPost && !p.cited}
					onChangeVersion={(v) => changeVersion(v)}
				/>
				<!-- TODO: horizontal scroll progress bar for the height of PostBlocks taller than 100vh? What if the PostBlock is nested? Just for 0 depth PostBlocks? vertical scroll progress bar on PostBlocks taller than the page  -->
			</div>
			{#if !open && !p.nested && hasParent(p.post)}
				<Highlight {evenBg} postIdStr={atPostIdStr} class="-left-0.5" />
			{/if}
			<Highlight
				main={!p.cited}
				{postIdStr}
				{evenBg}
				class={p.nested || !p.cited ? '-left-5' : p.cited ? '-left-2.5 -bot tom-1' : ''}
			/>
			{#if open}
				<div class={`pr-1 ${p.cited ? '' : 'pb-2'}`}>
					{#if tags?.length || rxnCountEntries.length}
						<div class="-mx-1 flex flex-wrap text-sm">
							{#each tags || [] as tag (tag)}
								<Apush
									href={`/__${gs.currentSpaceMs}?q=${encodeURIComponent(`[${tag}]`)}`}
									class={`font-bold text-fg2 px-1 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
								>
									{tag}
								</Apush>
							{/each}
							{#each rxnCountEntries as [emoji, count], i}
								<button
									class={`group fx h-5 px-1 ${
										evenBg //
											? p.post.myRxns?.includes(emoji)
												? 'bg-bg4 hover:bg-bg5 border-b border-b-hl1'
												: 'hover:bg-bg4'
											: p.post.myRxns?.includes(emoji)
												? 'bg-bg5 hover:bg-bg6 border-b border-hl1'
												: 'hover:bg-bg5'
									}`}
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
									<p
										class={`${p.post.myRxns?.includes(emoji) ? '' : 'grayscale-75'} group-hover:grayscale-0`}
									>
										{emoji}
									</p>
									<p class={`ml-1.5 font-bold ${p.post.myRxns?.includes(emoji) ? 'text-fg3' : ''}`}>
										{count}
									</p>
								</button>
								{#if i === rxnCountEntries.length - 1}
									<div class="h-5 xy">
										<button
											class={`group xy h-7 w-7 text-fg2 hover:text-fg1`}
											onclick={() => {
												resetBottomOverlay('rh');
												gs.showReactionHistory =
													gs.showReactionHistory && postIdStr === getIdStr(gs.showReactionHistory)
														? null
														: p.post;
											}}
										>
											<div
												class={`h-5 w-7 xy ${evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}
											>
												<IconChartBarPopular stroke={2.5} class="w-3.5" />
											</div>
										</button>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
					{#if core}
						{#if parsed}
							<!-- overflow-hidden makes the Highlight of cited posts with cited posts the correct height. idk y -->
							<div class="overflow-hidden">
								<CoreParser {core} miniCites={p.cited} depth={p.depth} />
							</div>
						{:else}
							<p class="whitespace-pre-wrap break-all font-thin font-mono">{core}</p>
						{/if}
					{:else}
						<p class={`text-fg2 font-bold italic`}>
							{deleted ? m.deleted() : m.blank()}
						</p>
					{/if}
				</div>
			{/if}
		</div>
		{#if p.nested && p.post.subIds?.length}
			<div class={open ? '' : 'hidden'}>
				{#each p.post.subIds as id (id)}
					{#if gs.idToPostMap[id]}
						<Self {...p} depth={p.depth + 1} post={gs.idToPostMap[id]} />
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
