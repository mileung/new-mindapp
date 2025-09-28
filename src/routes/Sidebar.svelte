<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { unsaveTagInPersona } from '$lib/accounts';
	import { textInputFocused } from '$lib/dom';
	import { gs } from '$lib/globalState.svelte';
	import { updateLocalCache } from '$lib/localCache';
	import { m } from '$lib/paraglide/messages';
	import { bracketRegex } from '$lib/tags';
	import {
		IconHelpSquareRounded,
		IconPuzzle,
		IconSearch,
		IconSettings,
		IconUserPlus,
		IconX,
	} from '@tabler/icons-svelte';
	import { matchSorter } from 'match-sorter';
	import { onMount } from 'svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let searchIpt: HTMLInputElement;
	let searchA: HTMLAnchorElement;
	let searchedText = $state(page.url.searchParams.get('q') || '');
	let searchVal = $state((() => searchedText)());
	let searchIptFocused = $state(false);
	let xFocused = $state(false);
	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let browserExtensionAdded = $state(true);
	let tagIndex = $state(-1);
	let accountMenuOpen = $state(false);
	let spaceMenuOpen = $state(false);
	let tagFilter = $derived(
		searchVal.trim().replace(bracketRegex, '').replace(/\s\s+/g, ' ').trim(),
	);
	let allTagsSet = $derived(new Set(gs.accounts[0]?.tags || []));
	let suggestedTags = $derived.by(() => {
		if (!searchIptFocused || !tagFilter) return [];
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

	let changeCurrentSpace = (inId: string) => {
		goto(`/__${inId}`);
		updateLocalCache((lc) => {
			lc.accounts[0].currentSpaceId = inId;
			return lc;
		});
	};

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
		if (q && gs.accounts[0]) {
			page.state.modalId = undefined;
			let urlPath = `/__${gs.accounts[0].currentSpaceId}?q=${q}`;
			if (e.metaKey) open(urlPath, '_blank');
			else goto(urlPath);
		}
	};

	$effect(() => {
		// console.log(gs.accounts[0]?.currentSpaceId);
		// console.log(gs.accounts[0]?.id);
		// console.log($inspect(gs.accounts[0]?.spaceIds));
	});
</script>

<svelte:window
	on:keydown={(e) => {
		if (!textInputFocused()) {
			e.key === '/' && setTimeout(() => searchIpt.focus(), 0); // setTimeout prevents inputting '/' on focus
			if (e.key === 'Escape') {
				if (accountMenuOpen || spaceMenuOpen) {
					accountMenuOpen = spaceMenuOpen = false;
				} else {
					gs.writerMode ? (gs.writerMode = '') : goto(`/__${gs.accounts[0].currentSpaceId}`);
				}
			}
			if (e.ctrlKey && e.altKey && e.key === 'Tab') {
				let currentSpaceIdIndex = gs.accounts[0].spaceIds.indexOf(gs.accounts[0].currentSpaceId);
				let newSpaceIdIndex = currentSpaceIdIndex + (e.shiftKey ? -1 : 1);
				if (newSpaceIdIndex < 0) newSpaceIdIndex = gs.accounts[0].spaceIds.length - 1;
				if (newSpaceIdIndex >= gs.accounts[0].spaceIds.length) newSpaceIdIndex = 0;
				changeCurrentSpace(gs.accounts[0].spaceIds[newSpaceIdIndex]);
			}
		}
	}}
/>

<!-- TODO: header should go up off screen on scroll down for <xs screens -->
<div class="hidden xs:block w-[var(--w-sidebar)]"></div>
<aside class="top-0 fixed block w-screen xs:h-screen xs:w-[var(--w-sidebar)] z-50 bg-bg2">
	<div class="h-full flex-1 flex flex-col">
		<div class="flex">
			{#if searchIptFocused && tagFilter}
				<button class="h-9 w-9 xy hover:bg-bg5 text-fg1" onclick={() => searchIpt.blur()}>
					<IconX class="h-6 w-6" />
				</button>
			{:else}
				<button
					class="h-9 w-9 xy hover:bg-bg5"
					onclick={() => {
						spaceMenuOpen = false;
						accountMenuOpen = !accountMenuOpen;
					}}
				>
					{#if accountMenuOpen}
						<IconX class="h-6 w-6" />
					{:else}
						<AccountIcon id={`${gs.accounts[0]?.id ?? ''}`} />
					{/if}
				</button>
				<button
					class="xs:hidden h-9 w-9 xy hover:bg-bg5 text-fg1"
					onclick={() => {
						accountMenuOpen = false;
						spaceMenuOpen = !spaceMenuOpen;
					}}
				>
					{#if spaceMenuOpen}
						<IconX class="h-6 w-6" />
					{:else}
						<SpaceIcon id={`${gs.accounts[0]?.currentSpaceId ?? ''}`} />
					{/if}
				</button>
			{/if}
			<input
				bind:this={searchIpt}
				bind:value={searchVal}
				enterkeyhint="search"
				class="min-w-0 flex-1 pl-2 pr-10"
				placeholder={m.search()}
				onfocus={() => (searchIptFocused = true)}
				onblur={() => (searchIptFocused = false)}
				oninput={(e) => (tagIndex = -1)}
				onkeydown={(e) => {
					if (e.key === 'Escape') setTimeout(() => searchIpt.blur(), 0);
					if (e.key === 'Enter') {
						let tag = suggestedTags[tagIndex];
						xFocused ? unsaveTagInPersona(tag) : tag ? addTagToSearchInput(tag) : searchInput(e);
					}
					if (e.key === 'Tab' && !tagFilter) return;
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
						if (e.key === 'Tab') {
							if (tagIndex === suggestedTags.length - 1) {
								if (allTagsSet.has(suggestedTags[tagIndex])) {
									if (xFocused) return;
								} else return;
							}
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
				class="xy -ml-10 w-10 text-fg2 hover:text-fg1"
				href={`/?q=${encodeURIComponent(searchVal)}`}
			>
				<IconSearch class="h-6 w-6" />
			</a>
		</div>
		<div class="max-h-48 xs:max-h-none relative flex-1 overflow-scroll">
			<div class={searchIptFocused && tagFilter ? '' : 'hidden'}>
				{#if tagFilter}
					<p class="ml-1 mt-1 text-sm text-fg2">{m.tags()}</p>
				{/if}
				{#each suggestedTags as tag, i}
					<div
						class={`group/tag fx hover:bg-bg5 ${tagIndex === i ? 'bg-bg5' : ''}`}
						onmousedown={(e) => e.preventDefault()}
					>
						<button
							bind:this={tagSuggestionsRefs[i]}
							class={`relative h-8 truncate flex-1 text-left px-2 text-nowrap text-lg`}
							onclick={() => addTagToSearchInput(tag)}
						>
							{#if tagIndex === i && !xFocused}
								<div
									class="absolute left-0 top-0 bottom-0 w-0.5 bg-hl1 group-hover/tag:bg-hl2"
								></div>
							{/if}
							{tag}
						</button>
						{#if allTagsSet.has(tag)}
							<button
								bind:this={unsaveTagXRefs[i]}
								class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex xy h-8 w-8 hover:bg-bg7 group-active/x:bg-bg8 ${xFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
								onclick={() => unsaveTagInPersona(tag)}
							>
								<IconX class="h-5 w-5" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
			<div class={`${accountMenuOpen ? '' : 'hidden'}`} onclick={() => (accountMenuOpen = false)}>
				{#each gs.accounts as a, i}
					<a class={`relative fx gap-1 p-2 h-10 w-full ${!i ? 'bg-bg5' : ''} hover:bg-bg5`}>
						{#if !i}
							<div class="absolute left-0 h-full w-0.5 bg-hl1"></div>
						{/if}
						<AccountIcon id={a.id} />
						{(() => {
							let accountJson = gs.thoughts[a.id]?.body;
							if (accountJson) {
								let obj = JSON.parse(accountJson);
								return obj + '';
							}
							return '';
						})() || m.anon()}
					</a>
				{/each}
				<a href="/sign-in" class={`fx gap-1 p-2 h-10 w-full hover:bg-bg5`}>
					<IconUserPlus class="h-6 w-6" />
					{m.addAccount()}
				</a>
				<a href="/settings" class={`fx gap-1 p-2 h-10 w-full hover:bg-bg5`}>
					<IconSettings class="h-6 w-6" />
					{m.settings()}
				</a>
				<a href="/user-guide" class={`fx gap-1 p-2 h-10 w-full hover:bg-bg5`}>
					<IconHelpSquareRounded class="h-6 w-6" />
					{m.userGuide()}
				</a>
			</div>
			<div
				class={`${spaceMenuOpen ? '' : `hidden ${accountMenuOpen || (searchIptFocused && tagFilter) ? '' : 'xs:block'}`}`}
			>
				<a
					id="mindapp-extension"
					target="_blank"
					href="https://chromewebstore.google.com/detail/mindapp/cjhokcciiimochdgkicpifkkhndegkep?authuser=0&hl=en"
					class={`fx gap-1 p-2 h-12 text-black bg-hl1 hover:bg-hl2`}
				>
					<IconPuzzle class="h-6 w-9" />
					<p class="leading-4.5 font-medium">{m.addBrowserExtension()}</p>
				</a>
				{#each gs.accounts[0]?.spaceIds || [] as id}
					<div class={`flex ${id === gs.accounts[0].currentSpaceId ? 'bg-bg5' : ''} hover:bg-bg5`}>
						<a
							href={`/__${id ?? ''}`}
							class={`flex-1 fx gap-1 p-2 h-12`}
							onclick={(e) => {
								e.preventDefault();
								spaceMenuOpen = false;
								changeCurrentSpace(id);
							}}
						>
							{#if id === gs.accounts[0].currentSpaceId}
								<div class="absolute left-0 h-12 w-0.5 bg-hl1"></div>
							{/if}
							<SpaceIcon {id} class="h-6 w-9" />
							<p class="font-medium">
								{!id
									? m.local()
									: id === '0'
										? m.personal()
										: id === '1'
											? m.global()
											: gs.spaces[id]?.id}
							</p>
						</a>
						<!-- {#if i === gs.accounts[0]?.currentSpaceId}
							<button class="text-fg2 hover:text-fg1 p-2">
								{#if gs.spaces[gs.accounts[0]?.currentSpaceId!]?.nested}
									<IconListTree />
								{:else}
									<IconList />
								{/if}
							</button>
						{/if} -->
					</div>
				{/each}
				<!-- <a href="/add-space" class="fx gap-1 p-2 h-12 hover:bg-bg5">
					<IconSquarePlus2 class="h-6 w-9" />
					{m.addSpace()}
				</a> -->
			</div>
		</div>
	</div>
</aside>
