<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { textInputFocused } from '$lib/dom';
	import { gs, spaceMsToSpaceName } from '$lib/global-state.svelte';
	import { identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import {
		changeCurrentSpace,
		refreshCurrentAccount,
		updateLocalCache,
		updateSavedTags,
	} from '$lib/types/local-cache';
	import { bracketRegex } from '$lib/types/posts/getPostFeed';
	import {
		IconDotsVertical,
		IconHelpSquareRounded,
		IconLogout,
		IconPuzzle,
		IconSearch,
		IconSettings,
		IconSquarePlus2,
		IconTags,
		IconUserPlus,
		IconX,
	} from '@tabler/icons-svelte';
	import { matchSorter } from 'match-sorter';
	import { onMount } from 'svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let searchIpt: HTMLInputElement;
	let searchedText = $state(page.url.searchParams.get('q') || '');
	let searchVal = $state((() => searchedText)());
	let searchIptFocused = $state(false);
	let xFocused = $state(false);
	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let tagIndex = $state(-1);
	let accountMenuOpen = $state(false);
	let spaceMenuOpen = $state(false);
	let hideExtensionLink = $state(false);
	let tagFilter = $derived(
		searchVal.trim().replace(bracketRegex, '').replace(/\s\s+/g, ' ').trim(),
	);
	let savedTagsSet = $derived(new Set(gs.accounts ? gs.accounts[0].savedTags : []));
	let suggestedTags = $derived.by(() => {
		if (!searchIptFocused || !tagFilter) return [];
		let filter = tagFilter.replace(/\s+/g, ' ');
		let arr = matchSorter([...savedTagsSet], filter)
			.slice(0, 99)
			.concat(tagFilter);
		return [...new Set(arr)];
	});
	let showSuggestedTags = $derived(searchIptFocused && tagFilter);

	onMount(() => {
		let handler = (e: KeyboardEvent) => {
			if (!textInputFocused() && gs.currentSpaceMs !== undefined) {
				e.key === '/' && setTimeout(() => searchIpt.focus(), 0); // setTimeout prevents inputting '/' on focus
				if (e.key === 'Escape') {
					if (gs.writingNew || gs.writingTo || gs.writingEdit) {
						gs.writingNew = gs.writingTo = gs.writingEdit = false;
					} else if (accountMenuOpen || spaceMenuOpen) {
						accountMenuOpen = spaceMenuOpen = false;
					}
				}
				if (e.key === 'h') {
					gs.accounts && goto(`/__${gs.currentSpaceMs}`);
				}
				if (e.metaKey && e.key === 'Tab' && gs.accounts) {
					let currentSpaceMsIndex = gs.accounts[0].spaceMss.indexOf(gs.currentSpaceMs);
					let newSpaceMsIndex = currentSpaceMsIndex + (e.shiftKey ? -1 : 1);
					if (newSpaceMsIndex < 0) newSpaceMsIndex = 0;
					if (newSpaceMsIndex >= gs.accounts[0].spaceMss.length)
						newSpaceMsIndex = gs.accounts[0].spaceMss.length - 1;
					let inMs = gs.accounts[0].spaceMss[newSpaceMsIndex];
					changeCurrentSpace(inMs);
					goto(`/__${inMs}`);
				}
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});

	$effect(() => {
		!savedTagsSet.size && (xFocused = false);
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
		if (q && gs.accounts) {
			page.state.modalId = undefined;
			let urlPath = `/__${gs.currentSpaceMs}?q=${q}`;
			if (e.metaKey) open(urlPath, '_blank');
			else goto(urlPath);
		}
	};

	$effect(() => {
		// console.log($inspect(gs.accounts?.[0]));
		// console.log(gs.currentSpaceMs);
		// console.log(gs.accounts[0]?.id);
		// console.log($inspect(gs.accounts[0]?.spaceMss));
		// console.log('page.url.pathname:', page.url.pathname);
	});
</script>

<!-- TODO: remember scroll position and PostDrop states (open, parsed, etc) when switching spaces without flickering -->
<!-- TODO: header should go up off screen on scroll down for <xs screens -->

<!-- <div class="b hidden xs:block w-[var(--w-sidebar)]"></div> -->

<aside class="z-50 bottom-0 fixed block w-screen xs:h-screen xs:w-[var(--w-sidebar)] bg-bg2">
	<div class="h-full flex-1 flex flex-col-reverse xs:flex-col">
		<div class="flex h-9">
			{#if showSuggestedTags}
				<button
					class="w-9 xy hover:bg-bg5 text-fg1"
					onmousedown={(e) => e.preventDefault()}
					onclick={() => (searchVal = '')}
				>
					<IconX class="h-6 w-6" />
				</button>
			{:else}
				<button
					class="w-9 xy hover:bg-bg5"
					onclick={() => {
						spaceMenuOpen = false;
						accountMenuOpen = !accountMenuOpen;
					}}
				>
					{#if accountMenuOpen}
						<IconX class="h-6 w-6" />
					{:else if gs.accounts}
						<AccountIcon ms={gs.accounts[0]?.ms} class="h-6 w-6" />
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
					{:else if gs.accounts}
						<SpaceIcon ms={gs.currentSpaceMs!} class="h-6 w-6" />
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
						xFocused
							? updateSavedTags([tag], true)
							: tag
								? addTagToSearchInput(tag)
								: searchInput(e);
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
								if (savedTagsSet.has(suggestedTags[tagIndex])) {
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
			<a class="xy -ml-9 w-9 group" href={`/?q=${encodeURIComponent(searchVal)}`}>
				<div class="xy h-8 w-8 group-hover:bg-bg5">
					<IconSearch class="h-6 w-6" />
				</div>
			</a>
		</div>
		<div
			class={`${showSuggestedTags ? 'max-h-18' : 'max-h-38'} xs:max-h-none relative flex-1 overflow-scroll`}
		>
			<div class={showSuggestedTags ? '' : 'hidden'}>
				<!-- {#if tagFilter}
					<p class="ml-1 mt-1 text-sm text-fg2">{m.tags()}</p>
				{/if} -->
				{#each suggestedTags as tag, i (tag)}
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
						{#if savedTagsSet.has(tag)}
							<button
								bind:this={unsaveTagXRefs[i]}
								class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex xy h-8 w-8 hover:bg-bg7 ${xFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
								onclick={() => updateSavedTags([tag], true)}
							>
								<IconX class="h-5 w-5" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
			<div
				class={`${accountMenuOpen ? 'flex flex-col' : 'hidden'}`}
				onclick={(e) => !e.metaKey && (accountMenuOpen = false)}
			>
				<a href="/sign-in" class={`fx min-h-10 h-10 px-2 gap-2 font-medium hover:bg-bg5`}>
					<IconUserPlus class="h-6 w-6" />
					{m.addAccount()}
				</a>
				{#each gs.accounts || [] as a, i (a.ms)}
					<div
						class={`group/account flex ${!i ? 'bg-bg5' : ''} hover:bg-bg5`}
						onmousedown={(e) => e.preventDefault()}
					>
						<button
							class={`fx min-h-10 h-10 px-2 gap-2 font-medium flex-1 ${a.name ? '' : 'italic'}`}
							onclick={() => {
								if (gs.accounts) {
									updateLocalCache((lc) => {
										lc.accounts = [a, ...lc.accounts.filter((acc) => acc.ms !== a.ms)];
										return lc;
									});
									refreshCurrentAccount();
								}
							}}
						>
							{#if !i}
								<div class="absolute left-0 h-10 w-0.5 bg-hl1"></div>
							{/if}
							<div class="xy h-6 w-6">
								<AccountIcon ms={a.ms} class="h-6 w-6" />
							</div>
							{a.ms === 0 ? m.anon() : a.name || identikana(a.ms)}
						</button>
						{#if a.ms}
							<button
								class={`${0 === i ? '' : 'pointer-fine:hidden'} group-hover/account:flex xy w-8 hover:bg-bg7 ${xFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
								onclick={async () => {
									// await trpc().auth.signOut.mutate({ ...a, inMs: 0 });
									updateLocalCache((lc) => {
										lc.accounts = [...lc.accounts.filter((acc) => acc.ms !== a.ms)];
										return lc;
									});
								}}
							>
								<IconLogout class="h-5 w-5" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
			<div
				class={`${
					accountMenuOpen || //
					showSuggestedTags
						? 'hidden'
						: spaceMenuOpen
							? ''
							: 'hidden xs:flex h-full flex-col'
				}`}
				onclick={(e) => setTimeout(() => !e.metaKey && (spaceMenuOpen = false), 0)}
			>
				<div
					id="mindapp-extension"
					class={`flex text-black font-semibold bg-hl1 hover:bg-hl2 ${hideExtensionLink ? 'hidden' : ''}`}
				>
					<a
						target="_blank"
						href="https://chromewebstore.google.com/detail/mindapp/cjhokcciiimochdgkicpifkkhndegkep?authuser=0&hl=en"
						class="flex-1 h-12 fx px-2 gap-2 font-medium leading-4.5"
					>
						<div class="w-6"><IconPuzzle /></div>
						{m.addBrowserExtension()}
					</a>
					<button
						class="xy w-8"
						onclick={(e) => {
							hideExtensionLink = true;
							e.stopPropagation();
						}}
					>
						<IconX class="h-5" />
					</button>
				</div>
				{#if gs.accounts}
					<!-- <div class="h-10 flex">
						<a href="/contacts" class="flex-1 xy hover:bg-bg5">
							<IconAddressBook />
						</a>
					</div> -->
					<a
						href="/add-space"
						class={`fx min-h-10 h-10 px-2 gap-2 font-medium hover:bg-bg5 ${page.url.pathname === '/add-space' ? 'bg-bg5' : ''}`}
					>
						<IconSquarePlus2 class="h-6 w-6" />
						{m.addSpace()}
					</a>
					{#each gs.accounts[0].spaceMss || [] as ms, i (ms)}
						<div
							class={`flex group/space ${`/__${ms}` === page.url.pathname ? 'bg-bg5' : ''} hover:bg-bg5`}
						>
							<a
								href={`/__${ms}`}
								class={`flex-1 fx min-h-10 h-10 px-2 gap-2 font-medium`}
								onclick={(e) => {
									if (!e.metaKey && !e.shiftKey) changeCurrentSpace(ms);
								}}
							>
								{#if ms === gs.currentSpaceMs}
									<div class="absolute left-0 h-10 w-0.5 bg-hl1"></div>
								{/if}
								<SpaceIcon {ms} class="h-6 w-6" />
								{spaceMsToSpaceName(ms)}
							</a>
							<!-- TODO: IconCalendar -->
							<a
								href={`/__${ms}/tags`}
								class={`xy w-8 ${ms !== gs.currentSpaceMs ? 'pointer-fine:hidden' : ''} group-hover/space:flex hover:bg-bg8`}
								onclick={(e) => {
									if (!e.metaKey && !e.shiftKey) changeCurrentSpace(ms);
								}}
							>
								<IconTags class="h-5" />
							</a>
							<a
								href={`/__${ms}/dots`}
								class={`xy w-8 ${ms !== gs.currentSpaceMs ? 'pointer-fine:hidden' : ''} group-hover/space:flex hover:bg-bg8`}
								onclick={(e) => {
									if (!e.metaKey && !e.shiftKey) changeCurrentSpace(ms);
								}}
							>
								<IconDotsVertical class="h-5" />
							</a>
						</div>
					{/each}
				{/if}
				<div class="flex-1"></div>
				<a
					href="/user-guide"
					class={`fx min-h-10 h-10 px-2 gap-2 font-medium hover:bg-bg5 ${page.url.pathname === '/user-guide' ? 'bg-bg5' : ''}`}
				>
					<IconHelpSquareRounded class="h-6 w-6" />
					{m.userGuide()}
				</a>
				<a
					href="/settings"
					class={`fx min-h-10 h-10 px-2 gap-2 font-medium hover:bg-bg5 ${page.url.pathname === '/settings' ? 'bg-bg5' : ''}`}
				>
					<IconSettings class="h-6 w-6" />
					{m.settings()}
				</a>
			</div>
		</div>
	</div>
</aside>
