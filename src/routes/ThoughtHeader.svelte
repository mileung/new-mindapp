<script lang="ts">
	import { dev } from '$app/environment';
	import { pushState } from '$app/navigation';
	import { gs } from '$lib/global-state.svelte';
	import { copyToClipboard, identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs, minute } from '$lib/time';
	import {
		deleteThought,
		divideTags,
		getId,
		splitId,
		type ThoughtInsert,
	} from '$lib/types/thoughts';
	import {
		IconCheck,
		IconCornerUpLeft,
		IconDots,
		IconFingerprint,
		IconPencil,
		IconTrash,
		IconX,
	} from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';
	import { page } from '$app/state';

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

<div class="fx h-5 text-sm font-bold text-fg2">
	<!-- {#if dev}<p class="truncate mr-1">{id}</p>{/if} -->
	<a
		href={'/' + id}
		title={whenVerbose}
		class={`truncate pr-1 hover:text-fg1 h-7 xy`}
		onclick={(e) => {
			if (!e.metaKey && !e.shiftKey && !e.ctrlKey) {
				e.preventDefault();
				pushState('/' + id, { modalId: id });
			}
		}}
	>
		<p class="truncate">
			{when}{editMs ? ' *' : ''}
		</p>
	</a>
	<a
		href={`/__${p.thought.in_ms ?? ''}?q=by:${p.thought.by_ms || ''}`}
		class={`truncate h-6 px-1 fx gap-1 hover:text-fg1 ${
			gs.thoughts[p.thought.by_ms ?? ''] ? '' : 'italic'
		}`}
	>
		<AccountIcon id={`_${p.thought.by_ms ?? ''}_`} class="min-h-4 min-w-4 max-h-4 max-w-4" />
		<!-- TODO: names for users -->
		<p class="truncate">
			{p.thought.by_ms
				? gs.thoughts[p.thought.by_ms!]?.body || identikana(p.thought.by_ms)
				: m.anon()}
		</p>
	</a>
	<a
		href={`/__${p.thought.in_ms ?? ''}`}
		class={`truncate h-6 px-1 fx gap-1 hover:text-fg1 ${p.thought.in_ms ? '' : 'italic'}`}
	>
		<SpaceIcon id={`__${p.thought.in_ms ?? ''}`} class="min-h-4 min-w-4 max-h-4 max-w-4" />
		<p class={`truncate ${gs.thoughts[p.thought.in_ms || ''] ? '' : 'italic'}`}>
			{p.thought.in_ms === 0
				? m.personal()
				: p.thought.in_ms === 1
					? m.global()
					: p.thought.in_ms
						? gs.spaces[p.thought.in_ms]?.ms
						: m.local()}
		</p>
	</a>
	<!-- <button class="h-7 w-6 xy hover:text-fg1" onclick={handleCopyClick}>
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
	</button> -->
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

							let useRpc = splitId(page.state.modalId || page.params.id || '').in_ms !== '';
							let { soft } = await deleteThought(id, useRpc);
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
{#if authorTags.length}
	<div class="overflow-hidden">
		<div class="-mx-1 flex flex-wrap mini-scroll max-h-18">
			{#each authorTags as tag}
				<!-- TODO: Why does using leading-4 cause parent to scroll? -->
				<a
					href={`/__${gs.accounts![0].currentSpaceMs}?q=${encodeURIComponent(`[${tag}]`)}`}
					class="font-bold text-fg2 px-1 leading-5 hover:text-fg1"
				>
					{tag}
				</a>
			{/each}
		</div>
	</div>
{/if}
