<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { textInputFocused } from '$lib/dom';
	import { gs } from '$lib/global-state.svelte';
	import { setSearchParams } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { bracketRegex } from '$lib/types/posts/getPostFeed';
	import { searchGuideArr } from '$lib/types/posts/parseSearchQuery';
	import { IconSearch, IconX } from '@tabler/icons-svelte';
	import { matchSorter } from 'match-sorter';
	import { onMount } from 'svelte';

	let searchIpt: HTMLInputElement;
	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);

	let searchVal = $state((() => page.url.searchParams.get('q') || '')());
	let trimmedSearchVal = $derived(searchVal.trim());

	let searchUrl = $derived(
		setSearchParams({
			nested: null,
			flat: null,
			bumped: null,
			new: null,
			old: null,
			q: trimmedSearchVal,
		}),
	);

	let searchIptFocused = $state(false);
	let tagXFocused = $state(false);
	let tagIndex = $state(-1);
	let tagFilter = $derived(
		trimmedSearchVal.replace(bracketRegex, '').replace(/\s\s+/g, ' ').trim(),
	);
	let savedTagsSet = $derived(
		new Set(
			gs.accounts //
				? (JSON.parse(gs.accounts[0].savedTags.txt) as string[])
				: [],
		),
	);
	let showSuggestedTags = $derived(searchIptFocused && tagFilter);
	let suggestedTags = $derived.by(() => {
		if (!showSuggestedTags) return [];
		let filter = tagFilter.replace(/\s+/g, ' ');
		let arr = matchSorter([...savedTagsSet], filter)
			.slice(0, 88)
			.concat(tagFilter);
		return [...new Set(arr)];
	});

	$effect(() => {
		!savedTagsSet.size && (tagXFocused = false);
	});
	let addTagToSearchInput = (tag: string) => {
		searchVal = `${searchVal
			.replace(/\s\s+/g, ' ')
			.trim()
			.replace(new RegExp(tagFilter + '$'), '')
			.trim()}[${tag}] `.trimStart();
		setTimeout(() => searchIpt!.scrollTo({ left: Number.MAX_SAFE_INTEGER }), 0);
	};

	onMount(() => {
		let handler = (e: KeyboardEvent) => {
			if (!textInputFocused()) {
				e.key === '/' && setTimeout(() => searchIpt.focus(), 0);
			}
		};
		window.addEventListener('keydown', handler);
		return () => {
			window.removeEventListener('keydown', handler);
		};
	});

	let hoveringTopDiv = $state(false);
</script>

<div
	class={`bg-bg3 fixed max-h-38 flex flex-col ${hoveringTopDiv || searchIptFocused ? '' : 'hidden'} left-0 xs:left-[var(--w-sidebar)] right-0 bottom-9 text-nowrap overflow-scroll`}
	onmouseenter={() => (hoveringTopDiv = true)}
	onmouseleave={() => (hoveringTopDiv = false)}
>
	{#if showSuggestedTags}
		<!-- {#if tagFilter}
					<p class="ml-1 mt-1 text-sm text-fg2">{m.tags()}</p>
				{/if} -->
		{#each suggestedTags as tag, i (tag)}
			<div
				class={`group/tag fx hover:bg-bg6 ${tagIndex === i ? 'bg-bg6' : ''}`}
				onmousedown={(e) => e.preventDefault()}
			>
				{#if tagIndex === i && !tagXFocused}
					<div class="absolute z-10 h-8 w-0.5 bg-hl1 group-hover/tag:bg-hl2"></div>
				{/if}
				<button
					bind:this={tagSuggestionsRefs[i]}
					class={`relative h-8 text-nowrap overflow-scroll flex-1 text-left px-2 text-lg`}
					onclick={() => addTagToSearchInput(tag)}
				>
					{tag}
				</button>
				{#if savedTagsSet.has(tag)}
					<button
						bind:this={unsaveTagXRefs[i]}
						class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex xy h-8 w-8 hover:bg-bg7 hover:text-fg3 ${tagXFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
						onclick={() => {
							updateSavedTags([tag], true);
						}}
					>
						<IconX class="h-5 w-5" />
					</button>
				{/if}
			</div>
		{/each}
	{:else}
		<div class="p-2 text-wrap space-y-2">
			<p class="text-lg font-semibold">Search guide</p>
			{#each searchGuideArr as section}
				<p class="font-semibold">{section.title}</p>
				{#each section.syntax as [syntax, explanation]}
					<div class="fx items-start">
						<p class="font-mono text-nowrap min-w-38">{syntax}</p>
						<p class="text-fg2 flex-1 whitespace-break-spaces">
							{explanation}
						</p>
					</div>
				{/each}
				<p class="font-semibold">Examples</p>
				{#each section.examples as [example, explanation]}
					<div class="">
						<p class="font-mono">{example}</p>
						<p class="text-fg2">
							{explanation}
						</p>
					</div>
				{/each}
			{/each}
		</div>
	{/if}
</div>
<div class="flex-1 flex">
	<input
		bind:this={searchIpt}
		bind:value={searchVal}
		enterkeyhint="search"
		class="font-mono flex-1 px-2 bg-bg3 hover:bg-bg5"
		placeholder={m.search()}
		onfocus={() => {
			searchIptFocused = true;
		}}
		onblur={() => (searchIptFocused = false)}
		oninput={(e) => (tagIndex = -1)}
		onkeydown={(e) => {
			if (e.key === 'Escape') setTimeout(() => searchIpt.blur(), 0);
			if (e.key === 'Enter') {
				let tag = suggestedTags[tagIndex];
				if (tagXFocused) updateSavedTags([tag], true);
				else if (tag) addTagToSearchInput(tag);
				else if (trimmedSearchVal) {
					e.metaKey ? open(searchUrl, '_blank') : goto(searchUrl);
				}
			}
			if (e.key === 'Tab' && !tagFilter) return;
			if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp') {
				if (e.key === 'Tab' && tagIndex === -1) return;
				e.preventDefault();
				if (e.key === 'Tab') {
					tagXFocused = !tagXFocused;
					if (!tagXFocused) return;
				} else tagXFocused = false;
				let index = Math.max(tagIndex - 1, -1);
				tagSuggestionsRefs[index]?.focus();
				tagIndex = index;
				searchIpt.focus();
			}
			if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown') {
				if (e.key === 'Tab') {
					if (tagIndex === suggestedTags.length - 1) {
						if (savedTagsSet.has(suggestedTags[tagIndex])) {
							if (tagXFocused) return;
						} else return;
					}
				}
				e.preventDefault();
				if (e.key === 'Tab' && !tagXFocused && tagIndex > -1) {
					tagXFocused = true;
				} else {
					tagXFocused = false;
					let index = Math.min(tagIndex + 1, suggestedTags.length - 1);
					tagSuggestionsRefs[index]?.focus();
					tagIndex = index;
				}
				searchIpt.focus();
			}
		}}
	/>
	<a
		class={`xy -ml-9 w-9 group ${trimmedSearchVal ? 'text-fg1 hover:text-fg3' : 'text-fg2 pointer-events-none'}`}
		href={searchUrl}
	>
		<div class={`xy ${searchIptFocused ? 'h-8 w-8' : 'h-9 w-9'} group-hover:bg-bg6`}>
			<IconSearch class="h-6 w-6" />
		</div>
	</a>
</div>
