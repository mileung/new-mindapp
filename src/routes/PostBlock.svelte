<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { getAtIdStr, getFullIdObj, getIdStr } from '$lib/types/parts/partIds';
	import { getLastVersion, type Post } from '$lib/types/posts';
	import { getPostHistory } from '$lib/types/posts/getPostHistory';
	import { IconChartBarPopular, IconCornerUpLeft, IconMinus, IconPlus } from '@tabler/icons-svelte';
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
	let id = $derived(getIdStr(p.post));
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
	let reactionCountEntries = $derived(
		Object.entries(p.post.reactionCount || {}).sort(([, a], [, b]) => b - a),
	);
	let changeVersion = async (v: null | number) => {
		if (v !== null && !p.post.history?.[v]) {
			let { history } = await getPostHistory(getFullIdObj(p.post), v, p.post.in_ms > 0);
			if (!history) return;
			Object.keys(history).forEach((key) => history[key]?.tags?.sort());
			gs.idToPostMap[id] = {
				...gs.idToPostMap[id]!,
				history: {
					...gs.idToPostMap[id]!.history,
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
	{...p.cited ? {} : { id: 'm' + id }}
	class={`flex ${evenBg ? 'bg-bg1' : 'bg-bg2'}`}
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
			<div class="z-0 sticky top-0 bg-inherit h-5 w-5 xy">
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
			<div class={`z-20 bg-inherit ${p.cited ? '' : 'sticky top-0'}`}>
				{#if open && !p.nested && !p.cited && atPost}
					<div class="relative flex h-5 text-sm">
						<a
							href={`/_${p.post.by_ms}_${p.post.in_ms}`}
							class={`fx group hover:text-fg1`}
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
							<div
								class={`pl-2 pr-0.5 h-5 fx ${evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}
							>
								<!-- TODO: text color matches UserIcon -->
								<p class={`font-bold ${gs.idToPostMap[p.post.by_ms] ? '' : 'italic'}`}>
									<!-- TODO: names for users -->
									<!-- {p.post.by_ms ? getAccountName(...) || identikana(p.post.by_ms) : m.anon()} -->
									{identikana(atPost.by_ms)}
								</p>
							</div>
						</a>
						<a
							href={'/' + getIdStr(p.post)}
							class={`fx hover:text-fg3 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
							onclick={(e) => {
								// if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
								// 	e.preventDefault();
								// 	pushState('/' + p.post.atId, { modalId: p.post.atId! });
								// }
							}}
						>
							<p class={`mr-1 ${atPostDeleted ? 'text-fg2 font-bold italic text-xs' : ''}`}>
								: {atPostTxt}
							</p>
						</a>
						<button
							class={`flex-1 fx text-fg2 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
							onclick={() =>
								(gs.writingTo =
									gs.writingTo && getIdStr(gs.writingTo) === atPostIdStr ? false : atPost)}
						>
							<IconCornerUpLeft class="w-5" />
						</button>
						<Highlight reply {evenBg} id={atPostIdStr} />
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
				<!-- TODO: horizontal scroll progress bar for the height of PostBlocks taller than 100vh? What if the PostBlock is netted? Just for 0 depth PostBlocks?  -->
			</div>
			<Highlight
				{id}
				{evenBg}
				class={p.nested || !p.cited ? '-left-5' : p.cited ? '-left-2.5' : ''}
			/>
			{#if open}
				<div class={`pr-1 ${p.cited ? '' : 'pb-2'}`}>
					{#if tags?.length}
						<div class="-mx-1 flex flex-wrap text-sm">
							{#each tags as tag (tag)}
								<a
									href={`/__${gs.currentSpaceMs}?q=${encodeURIComponent(`[${tag}]`)}`}
									class={`font-bold text-fg2 px-1 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
								>
									{tag}
								</a>
							{/each}
							{#if p.post.reactionCount}
								{#each reactionCountEntries as [emoji, count], i}
									<button
										class={`group fx h-5 px-1 text-fg2 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
									>
										<p class="grayscale-75 group-hover:grayscale-0">{emoji}</p>
										<p class="ml-1.5 font-bold">{count}</p>
									</button>
									{#if i === reactionCountEntries.length - 1}
										<div class="h-5 xy">
											<button class={`group xy h-7 w-7 text-fg2 hover:text-fg1`}>
												<div
													class={`h-5 w-7 xy ${evenBg ? 'group-hover:bg-bg4' : 'group-hover:bg-bg5'}`}
												>
													<IconChartBarPopular stroke={2.5} class="w-3.5" />
												</div>
											</button>
										</div>
									{/if}
								{/each}
							{/if}
						</div>
					{/if}
					{#if core}
						{#if parsed}
							<CoreParser {core} miniCites={p.cited} depth={p.depth} />
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
