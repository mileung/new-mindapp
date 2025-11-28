<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { getAtIdStr, getFullIdObj, getIdStr } from '$lib/types/parts/partIds';
	import { getLastVersion, type Post } from '$lib/types/posts';
	import { getPostHistory } from '$lib/types/posts/getPostHistory';
	import { IconMinus, IconPlus } from '@tabler/icons-svelte';
	import CoreParser from './CoreParser.svelte';
	import Highlight from './Highlight.svelte';
	import Self from './PostBlock.svelte';
	import PostHeader from './PostHeader.svelte';

	let p: {
		post: Post;
		nested?: boolean;
		depth: number;
		boldTags?: string[];
		boldCore?: string[];
	} = $props();
	let container: HTMLDivElement;
	let open = $state(true);
	let parsed = $state(true);
	let id = $derived(getIdStr(p.post));
	let evenBg = $derived(!(p.depth % 2));
	let atPost = $derived(gs.idToPostMap[getAtIdStr(p.post) || '']);
	let atPostDeleted = $derived(atPost?.history === null);
	let deleted = $derived(p.post.history === null);

	let lastVersion = $derived(getLastVersion(p.post));
	let version = $state((() => lastVersion)());
	let layer = $derived(version === null ? null : p.post.history?.[version]);
	let core = $derived(layer?.core);
	let tags = $derived(layer?.tags);

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

<div bind:this={container} id={'m' + id} class={`flex ${evenBg ? 'bg-bg1' : 'bg-bg2'}`}>
	{#if p.nested}
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
					<IconMinus class="w-4" />
				{:else}
					<IconPlus class="w-4" />
				{/if}
			</div>
		</button>
	{/if}
	<div class={`bg-inherit flex-1 ${p.nested ? 'max-w-[calc(100%-1.25rem)]' : 'px-2'}`}>
		<div class={`relative bg-inherit ${open ? 'pb-2' : ''}`}>
			<div class="z-10 sticky top-0 bg-inherit">
				<!-- {#if !p.nested && p.post.atId}
					<div class="relative fx">
						<a
							href={'/' + p.post.atId}
							class="group fx gap-0.5 text-sm hover:text-fg3"
							onclick={(e) => {
								if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
									e.preventDefault();
									pushState('/' + p.post.atId, { modalId: p.post.atId! });
								}
							}}
						>
							<div
								class="self-end h-2.5 w-2.5 mt-1.5 border-t-2 border-l-2 border-fg2 group-hover:border-fg1"
							></div>
							<p
								class={`flex-1 ${atPostDeleted ? 'text-fg2 font-bold italic text-xs' : ''}`}
							>
								{atPostDeleted ? m.deleted() : atPost?.txt || p.post.atId}
							</p>
						</a>
						<button
							class="flex-1 fx justify-end text-fg2 hover:text-fg1"
							onclick={() =>
								(gs.writingTo =
									gs.writingTo && getId(gs.writingTo) === getId(p.post.atId)
										? ''
										: ['to', p.post.atId!])}
						>
							<IconCornerUpLeft class="w-5" />
						</button>
						<Highlight id={p.post.atId} class="-left-2" />
					</div>
				{/if} -->
				<PostHeader
					{...p}
					{open}
					{evenBg}
					{parsed}
					onToggleParsed={() => (parsed = !parsed)}
					{lastVersion}
					{version}
					onChangeVersion={(v) => changeVersion(v)}
				/>
				<!-- TODO: horizontal scroll progress bar for the height of PostBlocks taller than 100vh? What if the PostBlock is netted? Just for 0 depth PostBlocks?  -->
			</div>
			<Highlight {id} class={p.nested ? '-left-5' : `-left-2 ${p.post.at_ms ? 'top-6' : ''}`} />
			{#if open}
				<div class="pr-1">
					{#if tags?.length}
						<div class="overflow-hidden">
							<div class="-mx-1 flex flex-wrap mini-scroll max-h-18">
								{#each tags as tag}
									<!-- TODO: Why does using leading-4 cause parent to scroll? -->
									<a
										href={`/l_l_${gs.currentSpaceMs}?q=${encodeURIComponent(`[${tag}]`)}`}
										class={`font-bold text-fg2 px-1 leading-5 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
									>
										{tag}
									</a>
								{/each}
							</div>
						</div>
					{/if}
					{#if core}
						{#if parsed}
							<CoreParser {core} depth={p.depth} />
						{:else}
							<p class="whitespace-pre-wrap break-all font-thin font-mono">{core}</p>
						{/if}
					{:else}
						<p class={`text-fg2 font-bold italic`}>
							{deleted ? m.deleted() : m.blank()}
						</p>
					{/if}
					<!-- TODO: reactions stuff -->
					{#if p.post.reactionCount}
						<div class="fx">
							{#each Object.entries(p.post.reactionCount) as [emoji, count]}
								<button class="fx h-7 text-sm">
									{emoji}
									<p class="ml-1 text-xs font-bold">{count}</p>
								</button>
							{/each}
						</div>
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
