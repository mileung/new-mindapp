<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { gs } from '$lib/globalState.svelte';
	import { m } from '$lib/paraglide/messages';
	import { getId, type ThoughtNested } from '$lib/thoughts';
	import { IconCornerUpLeft, IconMinus, IconPlus } from '@tabler/icons-svelte';
	import BodyParser from './BodyParser.svelte';
	import Self from './ThoughtDrop.svelte';
	import ThoughtHeader from './ThoughtHeader.svelte';
	import Highlight from './Highlight.svelte';

	let p: {
		thought: ThoughtNested;
		nested?: boolean;
		depth: number;
		boldTags?: string[];
		boldBody?: string[];
	} = $props();
	let container: HTMLDivElement;
	let open = $state(true);
	let parsed = $state(true);
	let id = $derived(getId(p.thought));
	let toThought = $derived(gs.thoughts[p.thought.to_id || '']);
	let evenBg = $derived(!(p.depth % 2));
	let deleted = $derived(p.thought.tags?.[0] === ' deleted');
	let deletedToThought = $derived(toThought?.tags?.[0] === ' deleted');
</script>

<div bind:this={container} id={'m' + id} class={`relative flex ${evenBg ? 'bg-bg1' : 'bg-bg2'}`}>
	{#if p.nested}
		<button
			class={`z-40 w-5 fy bg-inherit text-fg1 ${evenBg ? 'hover:bg-bg3' : 'hover:bg-bg4'}`}
			onclick={() => {
				let distanceFromTop = container.getBoundingClientRect().top;
				let willBeOpen = !open;
				if (!willBeOpen && distanceFromTop < (innerWidth > 500 ? 0 : 36))
					container.scrollIntoView({ block: 'start' });
				open = willBeOpen;
			}}
		>
			<div class="sticky top-0.5 z-0 bg-inherit m-0.5 h-4 w-4 xy">
				{#if open}
					<IconMinus class="w-4" />
				{:else}
					<IconPlus class="w-4" />
				{/if}
			</div>
		</button>
	{/if}
	<div class={`max-w-full bg-inherit flex-1 relative ${p.nested ? '' : 'px-2'}`}>
		<div class="relative bg-inherit">
			<div class="z-10 sticky top-0 bg-inherit">
				{#if !p.nested && p.thought.to_id}
					<div class="relative fx">
						<a
							href={`/${p.thought.to_id}`}
							class="group fx gap-0.5 text-sm hover:text-fg3 truncate"
							onclick={(e) => {
								if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
									e.preventDefault();
									pushState(`/${p.thought.to_id}`, { modalId: p.thought.to_id! });
								}
							}}
						>
							<div
								class="self-end h-2.5 w-2.5 mt-1.5 border-t-2 border-l-2 border-fg2 group-hover:border-fg1"
							></div>
							<p
								class={`flex-1 truncate ${deletedToThought ? 'text-fg2 font-bold italic text-xs' : ''}`}
							>
								{deletedToThought ? m.deleted() : toThought?.body || p.thought.to_id}
							</p>
						</a>
						<button
							class="flex-1 fx justify-end text-fg2 hover:text-fg1"
							onclick={() =>
								(gs.writerMode =
									gs.writerMode[0] === 'to' && gs.writerMode[1] === p.thought.to_id
										? ''
										: ['to', p.thought.to_id!])}
						>
							<IconCornerUpLeft class="w-5" />
						</button>
						<Highlight id={p.thought.to_id} class="-left-2" />
					</div>
				{/if}
				<ThoughtHeader {...p} {parsed} onToggleParsed={() => (parsed = !parsed)} />
			</div>
			<Highlight {id} class={p.nested ? '-left-5' : `-left-2 ${p.thought.to_id ? 'top-6' : ''}`} />
			<div class={open ? 'pb-1 pr-1' : 'hidden'}>
				{#if p.thought.body}
					{#if parsed}
						<BodyParser {...p} />
					{:else}
						<p class="whitespace-pre-wrap break-all font-thin font-mono">{p.thought.body}</p>
					{/if}
				{:else if !p.thought.body}
					<p class={`${deleted ? 'text-fg2 font-bold' : 'text-bg8 font-black'} italic text-xs`}>
						{!p.thought.tags?.length ? m.blank() : deleted ? m.deleted() : ''}
					</p>
				{/if}
			</div>
		</div>
		{#if p.nested && p.thought.childIds?.length}
			<div class={open ? '' : 'hidden'}>
				{#each p.thought.childIds as id}
					{#if gs.thoughts[id]}
						<Self {...p} depth={p.depth + 1} thought={gs.thoughts[id]} />
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
