<script lang="ts">
	import {
		IconArrowLeft,
		IconBrowser,
		IconMenu2,
		IconPuzzle,
		IconSearch,
		IconSettings,
		IconX,
	} from '@tabler/icons-svelte';

	import { matchSorter } from 'match-sorter';
	import { page } from '$app/state';
	import { bracketRegex } from '$lib/tags';
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { gs } from '$lib/globalState.svelte';
	import { onMount } from 'svelte';
	import { unsaveTagInPersona } from '$lib/personas';

	let searchIpt: HTMLInputElement;
	let searchA: HTMLAnchorElement;
	let searchedText = $state(page.url.searchParams.get('q') || '');
	let searchVal = $state((() => searchedText)());
	let searchIptFocused = $state(false);
	let showingSideMenu = $state(false);
	let showingBurgerMenu = $state(false);
	let xFocused = $state(false);
	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let browserExtensionAdded = $state(true);
	let tagIndex = $state<number>(0);
	let tagFilter = $derived(
		searchVal.trim().replace(bracketRegex, '').replace(/\s\s+/g, ' ').trim(),
	);
	let allTagsSet = $derived(new Set(gs.personas[0]?.tags || []));
	let suggestedTags = $derived.by(() => {
		if (!showingSideMenu || !tagFilter) return [];
		let filter = tagFilter.replace(/\s+/g, ' ');
		let arr = matchSorter([...allTagsSet], filter)
			.slice(0, 99)
			.concat(tagFilter);
		return [...new Set(arr)];
	});
	$effect(() => {
		!allTagsSet.size && (xFocused = false);
	});

	onMount(() => {
		// @ts-ignore
		browserExtensionAdded = !!window.mindappBrowserExtensionAdded;
	});

	let addTagToSearchInput = (tag: string) => {
		searchVal = `${searchVal
			.replace(/\s\s+/g, ' ')
			.trim()
			.replace(new RegExp(tagFilter + '$'), '')
			.trim()}[${tag}] `.trimStart();
		setTimeout(() => searchIpt!.scrollTo({ left: Number.MAX_SAFE_INTEGER }), 0);
	};

	let searchInput = (e: KeyboardEvent) => {
		let q = encodeURIComponent(searchVal.trim());
		if (q) {
			if (e.metaKey) window.open(`/?q=${q}`, '_blank');
			else goto(`/?q=${q}`);
		}
	};

	$effect(() => {
		if (searchIptFocused) showingSideMenu = true;
	});
</script>

<svelte:window
	on:keydown={(e) => {
		if (e.key === '/') {
			const activeElement = document.activeElement!;
			if (!['INPUT', 'TEXTAREA'].includes(activeElement.tagName)) {
				setTimeout(() => searchIpt?.focus(), 0); // setTimeout prevents inputting '/' on focus
			}
		}
	}}
/>
<div class="w-[var(--w-sidebar)]"></div>
<aside class="w-[var(--w-sidebar)] z-50 fixed h-screen bg-bg2">
	<div class="h-full flex-1 flex flex-col">
		<div class="p-2 pb-1 gap-2 flex">
			{#if showingSideMenu}
				<button
					class="h-8 w-8 xy rounded transition hover:bg-bg5 text-fg1"
					onclick={() => {
						searchIpt?.blur();
						if (showingSideMenu) showingSideMenu = false;
						else showingBurgerMenu = !showingBurgerMenu;
					}}
				>
					<IconArrowLeft class="h-6 w-6" />
				</button>
			{:else}
				<!-- <IconMenu2 class="h-6 w-6" /> -->
				<a href="/settings" class="h-8 w-8 xy rounded transition hover:bg-bg5 text-fg1">
					<IconSettings class="h-6 w-6" />
				</a>
			{/if}
			<input
				bind:this={searchIpt}
				bind:value={searchVal}
				enterkeyhint="search"
				class="min-w-0 flex-1 pl-2 pr-10 rounded bg-bg5"
				placeholder={m.search()}
				onfocus={() => (searchIptFocused = true)}
				onblur={() => (searchIptFocused = false)}
				oninput={(e) => (tagIndex = -1)}
				onkeydown={(e) => {
					// if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
					// 	e.preventDefault();
					// 	let index = Math.min(
					// 		Math.max(tagIndex + (e.key === 'ArrowUp' ? -1 : 1), -1),
					// 		suggestedTags.length - 1,
					// 	);
					// 	tagSuggestionsRefs[index]?.focus();
					// 	searchIpt?.focus();
					// 	tagIndex = index;
					// }

					if (e.key === 'Escape') {
						showingSideMenu = false;
						searchIpt?.blur();
					}
					if (e.key === 'Enter') {
						let tag = suggestedTags[tagIndex];
						xFocused ? unsaveTagInPersona(tag) : tag ? addTagToSearchInput(tag) : searchInput(e);
					}
					if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp') {
						if (e.key === 'Tab' && tagIndex === -1) return;
						e.preventDefault();
						if (e.key === 'Tab') {
							xFocused = !xFocused;
							if (!xFocused) return;
						} else xFocused = false;
						let index = Math.max(tagIndex - 1, -1);
						tagSuggestionsRefs[index]?.focus();
						tagIndex = index;
						searchIpt.focus();
					}
					if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown') {
						if (e.key === 'Tab' && tagIndex === suggestedTags.length - 1) {
							if (allTagsSet.has(suggestedTags[tagIndex])) {
								if (xFocused) return; // bodyTa.focus();
							} else return; // bodyTa.focus();
						}
						e.preventDefault();
						if (e.key === 'Tab' && !xFocused && tagIndex > -1) {
							xFocused = true;
						} else {
							xFocused = false;
							let index = Math.min(tagIndex + 1, suggestedTags.length - 1);
							tagSuggestionsRefs[index]?.focus();
							tagIndex = index;
						}
						searchIpt.focus();
					}
				}}
			/>
			<a
				bind:this={searchA}
				class="xy -ml-12 w-10 rounded transition text-fg2 hover:text-fg1"
				href={`/?q=${encodeURIComponent(searchVal)}`}
			>
				<IconSearch class="h-6 w-6" />
			</a>
		</div>
		<div class="relative p-2 pt-1 flex-1 overflow-scroll">
			{#if !browserExtensionAdded}
				<div class="reveal">
					<a
						target="_blank"
						href="https://chromewebstore.google.com/detail/mindapp/cjhokcciiimochdgkicpifkkhndegkep?authuser=0&hl=en"
						class={`z-0 fx rounded gap-2 p-2 h-14 w-full text-bg1 transition bg-hl1 hover:bg-hl2`}
					>
						<div class="xy h-10 w-10"><IconPuzzle class="h-7 w-7" /></div>
						<p class="leading-4.5 font-medium">{m.addBrowserExtension()}</p>
					</a>
				</div>
			{/if}
			{#each gs.personas.length ? gs.personas[0]!.spaceIds.slice(0, 1) : [undefined] as id, i}
				<a
					href="/"
					class={`translate-0 fx rounded gap-2 p-2 h-14 w-full transition hover:bg-bg5 ${i ? '' : 'bg-bg5'}`}
					onmousedown={(e) => e.preventDefault()}
				>
					<div class="xy bg-bg8 h-10 w-10 rounded-full"><IconBrowser class="h-7 w-7" /></div>
					<p class="font-medium">{m.local()}</p>
				</a>
				<!-- <a
					href="/"
					class={`translate-0 fx rounded gap-2 px-2 py-1 h-14 w-full transition hover:bg-bg5 ${i ? '' : 'bg-bg5'}`}
					onmousedown={(e) => e.preventDefault()}
				>
					<IconBrowser class="h-7 w-7" />
					<div class="flex-1 h-full">
						<p class="leading-4 font-medium">{m.local()}</p>
						<p class="text- xs text-fg2 line-clamp-2">
							{gs.thoughts[gs.feeds[id || '']?.[0]!]?.body || ''}
						</p>
					</div>
				</a> -->
			{/each}
			{#if showingSideMenu}
				<div class="absolute p-2 pt-0 bg-bg2 inset-0 overflow-scroll">
					{#if suggestedTags.length}
						<p class="text-sm text-fg2">{m.tags()}</p>
					{/if}
					{#each suggestedTags as tag, i}
						<div class={`rounded group/tag fx hover:bg-bg5 ${tagIndex === i ? 'bg-bg5' : ''}`}>
							<button
								bind:this={tagSuggestionsRefs[i]}
								class={`relative h-8 rounded truncate flex-1 text-left px-2 text-nowrap text-lg`}
								onmousedown={(e) => e.preventDefault()}
								onclick={() => addTagToSearchInput(tag)}
							>
								{#if tagIndex === i && !xFocused}
									<div
										class="absolute rounded-r left-0 top-0 bottom-0 w-0.5 transition bg-hl1 group-hover/tag:bg-hl2"
									></div>
								{/if}
								{tag}
							</button>
							{#if allTagsSet.has(tag)}
								<button
									bind:this={unsaveTagXRefs[i]}
									class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex group/x xy h-8 w-8`}
									onclick={() => unsaveTagInPersona(tag)}
								>
									<div
										class={`xy h-7 w-7 rounded-full transition group-hover/x:bg-bg7 group-active/x:bg-bg8 ${xFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
									>
										<IconX class="h-5 w-5" />
									</div>
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</aside>

<!-- <div class="flex ml-12">
	<div class="bg-bg2 fixed left-0 w-12 h-screen flex flex-col p-1.5">
		<div class="flex-1 flex flex-col gap-1.5 pb-1.5 overflow-scroll">
			<a href="/search" class="xy aspect-square rounded transition bg-bg8 hover:bg-bg6 text-fg1">
				<IconSearch />
			</a>
			<button class="xy aspect-square rounded transition bg-bg8 hover:bg-bg6 text-fg1">
				<IconUser />
			</button>
			<a href="/" class="xy aspect-square rounded transition bg-bg8 hover:bg-bg6 text-fg1">
				<IconBrowser />
			</a>
		</div>
		<a href="/settings" class="xy aspect-square rounded transition bg-bg8 hover:bg-bg6 text-fg1">
			<IconSettings />
		</a>
	</div> -->
