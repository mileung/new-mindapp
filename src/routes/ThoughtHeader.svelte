<script lang="ts">
	import { dev } from '$app/environment';
	import { pushState } from '$app/navigation';
	import { gs } from '$lib/global-state.svelte';
	import { copyToClipboard } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { deleteThought, divideTags, getId, type ThoughtInsert } from '$lib/thoughts';
	import { formatMs, minute } from '$lib/time';
	import {
		IconCheck,
		IconCopy,
		IconCornerUpLeft,
		IconCube,
		IconCube3dSphere,
		IconDots,
		IconFingerprint,
		IconPencil,
		IconTrash,
		IconX,
	} from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let xBtn = $state<HTMLButtonElement>();
	let trashBtn = $state<HTMLButtonElement>();
	let pencilBtn = $state<HTMLButtonElement>();
	let fingerprintClicked = $state(false);
	let copyClicked = $state(false);

	function handleFingerprintClick() {
		copyToClipboard(id);
		fingerprintClicked = true;
		setTimeout(() => (fingerprintClicked = false), 1000);
	}
	function handleCopyClick() {
		copyToClipboard(p.thought.body || '');
		copyClicked = true;
		setTimeout(() => (copyClicked = false), 1000);
	}

	let p: {
		parsed: boolean;
		onToggleParsed: () => void;
		thought: ThoughtInsert;
	} = $props();
	let moreOptionsOpen = $state(false);

	let id = $derived(getId(p.thought));
	let when = $derived(formatMs(p.thought.ms || 0));
	let { authorTags, systemTags } = $derived(divideTags(p.thought));
	let editMs = $derived.by(() => {
		let editedTag = systemTags.find((t) => t.startsWith(' edited:'));
		let editMs = editedTag ? +editedTag.slice(8) : null;
		return editMs;
	});
	let whenVerbose = $derived(
		`${formatMs(p.thought.ms || 0, true)}${editMs ? ' - ' + formatMs(editMs, true) : ''}`,
	);
</script>

<div class="text-sm fx h-5 text-fg2 max-w-full">
	<a
		href={'/' + id}
		title={whenVerbose}
		class={`font-bold ${when.length > 9 ? 'truncate' : ''} text-fg2 hover:text-fg1 h-7 xy`}
		onclick={(e) => {
			if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
				e.preventDefault();
				pushState('/' + id, { modalId: id });
			}
		}}
	>
		{when}{editMs ? ' *' : ''}
	</a>
	<a
		href={`/__${p.thought.in_ms ?? ''}?q=by:${p.thought.by_ms || ''}`}
		class={`h-6 pl-2 pr-1 truncate fx text-sm font-bold text-fg2 hover:text-fg1 ${
			gs.thoughts[p.thought.by_ms ?? ''] ? '' : 'italic'
		}`}
	>
		<AccountIcon id={`_${p.thought.by_ms ?? ''}_`} class="h-3.5 w-3.5 mr-0.5" />
		<!-- TODO: names for users -->
		<p class="whitespace-nowrap truncate">
			{p.thought.by_ms ? gs.thoughts[p.thought.by_ms!]?.body || m.noName() : m.anon()}
		</p>
	</a>
	<a
		href={`/__${p.thought.in_ms ?? ''}`}
		class={`h-6 px-1 mr-auto truncate fx text-sm font-bold text-fg2 hover:text-fg1 ${
			p.thought.in_ms ? '' : 'italic'
		}`}
	>
		<div class="xy pr-1 h-5 w-5">
			<SpaceIcon id={`__${p.thought.in_ms ?? ''}`} />
		</div>
		<p class={`whitespace-nowrap truncate ${gs.thoughts[p.thought.in_ms || ''] ? '' : 'italic'}`}>
			{p.thought.in_ms === 0
				? m.personal()
				: p.thought.in_ms === 1
					? m.global()
					: p.thought.in_ms
						? gs.spaces[p.thought.in_ms]?.ms
						: m.local()}
		</p>
	</a>
	<button class="h-7 w-6 xy hover:text-fg1" onclick={handleCopyClick}>
		{#if copyClicked}
			<IconCheck class="h-4 w-4" />
		{:else}
			<IconCopy class="h-4 w-4" />
		{/if}
	</button>
	<button class="h-7 w-6 xy hover:text-fg1" onclick={p.onToggleParsed}>
		{#if p.parsed}
			<IconCube class="h-4 w-4" />
		{:else}
			<IconCube3dSphere class="h-4 w-4" />
		{/if}
	</button>
	<button class="fx h-7 w-6 xy hover:text-fg1" onclick={handleFingerprintClick}>
		{#if fingerprintClicked}
			<IconCheck class="h-4 w-4" />
		{:else}
			<IconFingerprint class="h-4 w-4" />
		{/if}
		<!-- TODO: idk if I actually want to implement cite count -->
		<!-- <p class="ml-1">0</p> -->
	</button>
	<div class="flex-1 h-4 fx">
		<button
			class="flex-1 min-w-4 h-7 fx hover:text-fg1"
			onclick={() =>
				(gs.writerMode = gs.writerMode[0] === 'to' && gs.writerMode[1] === id ? '' : ['to', id])}
		>
			<IconCornerUpLeft class="w-5" />
			<!-- TODO: idk if I actually want to implement link count -->
			<!-- <p class="ml-0.5">0</p> -->
		</button>
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
					<button
						bind:this={trashBtn}
						class="h-7 w-6 xy hover:text-fg1"
						onclick={async () => {
							const ok =
								dev ||
								Date.now() - (p.thought.ms || 0) < minute ||
								confirm(m.areYouSureYouWantToDeleteThisThought());
							if (!ok) return;
							let { soft } = await deleteThought(id);
							gs.thoughts[id] = soft
								? {
										...gs.thoughts[id],
										body: null,
										tags: [' deleted'],
									}
								: null;
						}}
						onkeydown={(e) => e.key === 'Escape' && (moreOptionsOpen = false)}
					>
						<IconTrash class="w-5" />
					</button>
					<button
						bind:this={pencilBtn}
						class="h-7 w-6 xy hover:text-fg1"
						onclick={() =>
							(gs.writerMode =
								gs.writerMode[0] === 'edit' && gs.writerMode[1] === id ? '' : ['edit', id])}
						onkeydown={(e) => e.key === 'Escape' && (moreOptionsOpen = false)}
					>
						<IconPencil class="w-5" />
					</button>
				</div>
			{:else if p.thought.tags?.[0] !== ' deleted'}
				<button class="h-7 w-6 xy hover:text-fg1" onclick={() => (moreOptionsOpen = true)}>
					<IconDots class="absolute w-4" />
				</button>
			{/if}
		</div>
	</div>
</div>
{#if dev}<p class="font-bold text-fg2">{id}</p>{/if}
{#if authorTags.length}
	<div class="overflow-hidden">
		<div class="-mx-1 flex flex-wrap mini-scroll max-h-18">
			{#each authorTags as tag}
				<!-- TODO: Why does using leading-4 cause parent to scroll? -->
				<a
					href={`/__${gs.accounts[0].currentSpaceMs}?q=${encodeURIComponent(`[${tag}]`)}`}
					class="px-1 font-bold leading-5 text-fg2 hover:text-fg1"
				>
					{tag}
				</a>
			{/each}
		</div>
	</div>
{/if}
