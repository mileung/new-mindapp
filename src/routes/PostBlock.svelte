<script lang="ts">
	import { pushState } from '$app/navigation';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { getId } from '$lib/types/parts';
	import { IconCornerUpLeft, IconMinus, IconPlus } from '@tabler/icons-svelte';
	import BodyParser from './BodyParser.svelte';
	import Highlight from './Highlight.svelte';
	import Self from './PostBlock.svelte';
	import PostHeader from './PostHeader.svelte';
	import { getLastVersion, type Post } from '$lib/types/posts';

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
	// let toPost = $derived(gs.posts[p.post.toId || '']);
	let evenBg = $derived(!(p.depth % 2));
	// let deleted = $derived(p.post.tags?.[0] === ' deleted');
	// let deletedToPost = $derived(toPost?.tags?.[0] === ' deleted');
	let latestVersion = $derived(getLastVersion(p.post));
	let version = $state((() => latestVersion)());
	let { tags, body } = $derived(p.post.history[version]);
</script>

<div bind:this={container} id={'m' + id} class={`flex ${evenBg ? 'bg-bg1' : 'bg-bg2'}`}>
	{#if p.nested}
		<button
			class={`z-40 w-5 fy bg-inherit text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
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
					{parsed}
					onToggleParsed={() => (parsed = !parsed)}
					{latestVersion}
					{version}
					onChangeVersion={(v) => (version = v)}
				/>
			</div>
			<Highlight {id} class={p.nested ? '-left-5' : `-left-2 ${p.post.to_ms ? 'top-6' : ''}`} />
			<div class={open ? 'pr-1' : 'hidden'}>
				{#if body}
					{#if parsed}
						<BodyParser {body} depth={p.depth} />
					{:else}
						<p class="whitespace-pre-wrap break-all font-thin font-mono">{body}</p>
					{/if}
				{:else if !body}
					<!-- <p class={`${deleted ? 'text-fg2 font-bold' : 'text-bg8 font-black'} italic text-xs`}>
						{!p.post.tags?.length ? m.blank() : deleted ? m.deleted() : ''}
					</p> -->
				{/if}
			</div>
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
