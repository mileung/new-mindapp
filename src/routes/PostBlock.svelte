<script lang="ts">
	import { pushState } from '$app/navigation';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { getId, getSplitIdToSplitId, getToId } from '$lib/types/parts';
	import { IconCornerUpLeft, IconMinus, IconPlus } from '@tabler/icons-svelte';
	import BodyParser from './BodyParser.svelte';
	import Highlight from './Highlight.svelte';
	import Self from './PostBlock.svelte';
	import PostHeader from './PostHeader.svelte';
	import { getLastVersion, type Post } from '$lib/types/posts';
	import { getPostHistory } from '$lib/types/posts/getPostHistory';

	let p: {
		post: Post;
		nested?: boolean;
		depth: number;
		boldTags?: string[];
		boldBody?: string[];
	} = $props();
	let container: HTMLDivElement;
	let open = $state(true);
	let parsed = $state(true);
	let id = $derived(getId(p.post));
	let evenBg = $derived(!(p.depth % 2));
	let toPost = $derived(gs.posts[getToId(p.post) || '']);
	let deletedToPost = $derived(toPost?.history === null);
	let deleted = $derived(p.post.history === null);

	let lastVersion = $derived(getLastVersion(p.post) || 0);
	let version = $state((() => lastVersion)());
	let body = $derived(p.post.history?.[version]?.body);
	let tags = $derived(p.post.history?.[version]?.tags);

	let changeVersion = async (i: number) => {
		if (!p.post.history?.[i]) {
			let { history } = await getPostHistory(
				getSplitIdToSplitId(p.post),
				i,
				Number.isInteger(p.post.in_ms),
			);
			console.log('history:', history);
			gs.posts[id] = {
				...gs.posts[id]!,
				history: {
					...gs.posts[id]!.history,
					...history,
				},
			};
		}
		// TODO: show loader?
		version = i;
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
				if (!willBeOpen && distanceFromTop < (innerWidth > 500 ? 0 : 36))
					container.scrollIntoView({ block: 'start' });
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
				<!-- {#if !p.nested && p.post.toId}
					<div class="relative fx">
						<a
							href={'/' + p.post.toId}
							class="group fx gap-0.5 text-sm hover:text-fg3 truncate"
							onclick={(e) => {
								if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
									e.preventDefault();
									pushState('/' + p.post.toId, { modalId: p.post.toId! });
								}
							}}
						>
							<div
								class="self-end h-2.5 w-2.5 mt-1.5 border-t-2 border-l-2 border-fg2 group-hover:border-fg1"
							></div>
							<p
								class={`flex-1 truncate ${deletedToPost ? 'text-fg2 font-bold italic text-xs' : ''}`}
							>
								{deletedToPost ? m.deleted() : toPost?.txt || p.post.toId}
							</p>
						</a>
						<button
							class="flex-1 fx justify-end text-fg2 hover:text-fg1"
							onclick={() =>
								(gs.writingTo =
									gs.writingTo && getId(gs.writingTo) === getId(p.post.toId)
										? ''
										: ['to', p.post.toId!])}
						>
							<IconCornerUpLeft class="w-5" />
						</button>
						<Highlight id={p.post.toId} class="-left-2" />
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
			</div>
			<Highlight {id} class={p.nested ? '-left-5' : `-left-2 ${p.post.to_ms ? 'top-6' : ''}`} />
			{#if open}
				<div class="pr-1">
					{#if tags?.length}
						<div class="overflow-hidden">
							<div class="-mx-1 flex flex-wrap mini-scroll max-h-18">
								{#each tags as tag}
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
					{#if body}
						{#if parsed}
							<BodyParser {body} depth={p.depth} />
						{:else}
							<p class="whitespace-pre-wrap break-all font-thin font-mono">{body}</p>
						{/if}
					{:else}
						<p class={`text-fg2 font-bold italic`}>
							{!tags?.length ? m.blank() : deleted ? m.deleted() : ''}
						</p>
					{/if}
				</div>
			{/if}
		</div>
		{#if p.nested && p.post.subIds?.length}
			<div class={open ? '' : 'hidden'}>
				{#each p.post.subIds as id}
					{#if gs.posts[id]}
						<Self {...p} depth={p.depth + 1} post={gs.posts[id]} />
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
