<script lang="ts">
	import { goto, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { scrollToLastY, textInputFocused } from '$lib/dom';
	import { getBottomOverlayShown, gs, resetBottomOverlay } from '$lib/global-state.svelte';
	import { identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import {
		refreshCurrentAccount,
		signOut,
		unsaveAccount,
		updateLocalCache,
		updateSavedTags,
	} from '$lib/types/local-cache';
	import { getIdStrAsIdObj } from '$lib/types/parts/partIds';
	import { bracketRegex } from '$lib/types/posts/getPostFeed';
	import { spaceMsToName, type Space } from '$lib/types/spaces';
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
	import Apush from './Apush.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let searchIpt: HTMLInputElement;
	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);

	let hideExtensionLink = $state(false);
	let searchVal = $state((() => page.url.searchParams.get('q') || '')());

	let searchIptFocused = $state(false);
	let tagXFocused = $state(false);

	let showAccountMenu = $state(false);
	let showSpaceMenu = $state(false);
	let tagIndex = $state(-1);

	let idParamObj = $derived(page.params.id ? getIdStrAsIdObj(page.params.id) : null);
	let tagFilter = $derived(
		searchVal.trim().replace(bracketRegex, '').replace(/\s\s+/g, ' ').trim(),
	);
	let savedTagsSet = $derived(new Set(gs.accounts?.[0].savedTags || []));
	let showSuggestedTags = $derived(searchIptFocused && tagFilter);
	let suggestedTags = $derived.by(() => {
		if (!showSuggestedTags) return [];
		let filter = tagFilter.replace(/\s+/g, ' ');
		let arr = matchSorter([...savedTagsSet], filter)
			.slice(0, 88)
			.concat(tagFilter);
		return [...new Set(arr)];
	});

	onMount(() => {
		let handler = (e: KeyboardEvent) => {
			if (!textInputFocused() && gs.currentSpaceMs !== undefined) {
				// setTimeout prevents inputting '/' on focus
				e.key === '/' && setTimeout(() => searchIpt.focus(), 0);
				e.key === 'a' && (showAccountMenu = !showAccountMenu);
				// TODO: shortcut(s) to switch accounts
				e.key === 'h' && goto(`/__${gs.currentSpaceMs}`);
				e.key === 's' && goto(`/settings`);
				e.key === 'u' && goto(`/user-guide`);
				if (e.key === 'Escape') {
					if (getBottomOverlayShown()) {
						resetBottomOverlay();
					} else if (showAccountMenu || showSpaceMenu) {
						showAccountMenu = showSpaceMenu = false;
					} else {
						scrollToLastY(); // setTimeout helps prevents scroll flicker
						setTimeout(() => goto(`/__${gs.currentSpaceMs}`), 0);
					}
				}

				if (e.metaKey && e.ctrlKey && e.key === 'Tab' && gs.accounts) {
					let currentSpaceMsIndex = gs.accounts[0].spaceMss.indexOf(gs.currentSpaceMs);
					let newSpaceMsIndex = currentSpaceMsIndex + (e.shiftKey ? -1 : 1);
					if (newSpaceMsIndex < 0) newSpaceMsIndex = 0;
					if (newSpaceMsIndex >= gs.accounts[0].spaceMss.length)
						newSpaceMsIndex = gs.accounts[0].spaceMss.length - 1;
					let inMs = gs.accounts[0].spaceMss[newSpaceMsIndex];
					goto(`/__${inMs}`);
				}
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
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

	let searchInput = (e: KeyboardEvent) => {
		let q = encodeURIComponent(searchVal.trim());
		if (q && gs.accounts) {
			let urlPath = `/__${gs.currentSpaceMs}?q=${q}`;
			if (e.metaKey) open(urlPath, '_blank');
			else {
				// TODO: this stuff
				pushState(urlPath, { modalId: urlPath });
			}
		}
	};

	$effect(() => {
		// console.log($inspect(gs.accounts?.[0]));
		// console.log(gs.currentSpaceMs);
		// console.log(gs.accounts[0]?.id);
		// console.log($inspect(gs.accounts[0]?.spaceMss));
		// console.log('page.url.pathname:', page.url.pathname);
	});

	let sidebarSpaces = $derived<Space[]>(
		[
			...new Set([
				0,
				8,
				1,
				...(gs.pendingInvite?.in_ms ? [gs.pendingInvite.in_ms] : []),
				...(gs.accounts?.[0].spaceMss || []),
			]),
		]
			.map(
				(ms) =>
					gs.msToSpaceMap[ms] ||
					{
						0: { ms: 0, name: spaceMsToName(0) }, // local space ms - everything local
						8: { ms: 8, name: spaceMsToName(8) }, // personal space ms placeholder - everything private in cloud
						1: { ms: 1, name: spaceMsToName(1) }, // global space ms - everything public in cloud
					}[ms],
			)
			.filter((s) => !!s),
	);
</script>

<!-- TODO: remember PostDrop states (open, parsed, etc) when switching spaces -->

<aside class="z-50 bottom-0 fixed w-screen xs:h-screen xs:w-[var(--w-sidebar)] bg-bg2">
	<div
		class="hidden xs:block z-50 absolute right-0 h-screen cursor-col-resize w-0.5 hover:w-4"
		onmousedown={() => {
			// TODO: resizable sidebar. Might be better to just make the whole sidebar draggable.
			// If dragging on button or a tag, disable so it doesn't fire on moue up
			// Or just make the Search Icon draggable? IconGripHorizontal on hover an no text input?
		}}
	></div>
	<div class="h-full flex flex-col-reverse xs:flex-col">
		<div class="flex h-9">
			<button
				class="w-9 xy text-fg1 hover:text-fg3 hover:bg-bg5"
				onmousedown={(e) => showSuggestedTags && e.preventDefault()}
				onclick={() => {
					if (showSuggestedTags) searchVal = '';
					else {
						showSpaceMenu = false;
						showAccountMenu = !showAccountMenu;
					}
				}}
			>
				{#if showAccountMenu || showSuggestedTags}
					<IconX class="h-6 w-6" />
				{:else if gs.accounts}
					<AccountIcon isUser ms={gs.accounts[0]?.ms} class="h-6 w-6" />
				{/if}
			</button>
			<button
				class={`xs:hidden h-9 w-9 xy hover:bg-bg5 text-fg1 ${showSuggestedTags ? 'hidden' : ''}`}
				onclick={() => {
					showAccountMenu = false;
					showSpaceMenu = !showSpaceMenu;
				}}
			>
				{#if showSpaceMenu}
					<IconX class="h-6 w-6" />
				{:else if gs.accounts}
					<SpaceIcon ms={gs.currentSpaceMs!} class="h-6 w-6" />
				{/if}
			</button>
			<input
				bind:this={searchIpt}
				bind:value={searchVal}
				enterkeyhint="search"
				class="shrink-0 w-0 flex-1 pl-2 pr-10 hover:bg-bg5"
				placeholder={m.search()}
				onfocus={() => {
					searchIptFocused = true;
					showAccountMenu = false;
					showSpaceMenu = false;
				}}
				onblur={() => (searchIptFocused = false)}
				oninput={(e) => (tagIndex = -1)}
				onkeydown={(e) => {
					if (e.key === 'Escape') setTimeout(() => searchIpt.blur(), 0);
					if (e.key === 'Enter') {
						let tag = suggestedTags[tagIndex];
						tagXFocused
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
			<Apush
				class={`xy -ml-9 w-9 group ${searchVal ? 'text-fg1 hover:text-fg3' : 'text-fg2 pointer-events-none'}`}
				href={`/?q=${encodeURIComponent(searchVal)}`}
			>
				<div class={`xy ${searchIptFocused ? 'h-8 w-8' : 'h-9 w-9'} group-hover:bg-bg5`}>
					<IconSearch class="h-6 w-6" />
				</div>
			</Apush>
		</div>
		<div
			class={`${showSuggestedTags || showAccountMenu || showSpaceMenu ? '' : 'hidden'} ${showSuggestedTags ? 'max-h-18' : 'max-h-38'} xs:max-h-none relative flex-1 xs:flex flex-col overflow-scroll`}
			onclick={(e) => {
				setTimeout(() => {
					if (!e.metaKey) {
						showAccountMenu = false;
						showSpaceMenu = false;
					}
				}, 0);
			}}
		>
			{#if showSuggestedTags}
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
							class={`relative h-8 truncate text-nowrap flex-1 text-left px-2 text-lg`}
							onclick={() => addTagToSearchInput(tag)}
						>
							{#if tagIndex === i && !tagXFocused}
								<div
									class="absolute left-0 top-0 bottom-0 w-0.5 bg-hl1 group-hover/tag:bg-hl2"
								></div>
							{/if}
							{tag}
						</button>
						{#if savedTagsSet.has(tag)}
							<button
								bind:this={unsaveTagXRefs[i]}
								class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex xy h-8 w-8 hover:bg-bg7 hover:text-fg3 ${tagXFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
								onclick={() => updateSavedTags([tag], true)}
							>
								<IconX class="h-5 w-5" />
							</button>
						{/if}
					</div>
				{/each}
			{:else if showAccountMenu}
				<a href="/sign-in" class={`fx shrink-0 h-10 px-2 gap-2 font-medium hover:bg-bg5`}>
					<IconUserPlus class="h-6 w-6" />
					{m.addAccount()}
				</a>
				{#each gs.accounts || [] as a, i (a.ms)}
					<div class={`group flex ${!i ? 'bg-bg5' : ''} hover:bg-bg5`}>
						<button
							class={`max-w-full flex shrink-0 h-10 px-2 gap-2 font-medium flex-1 ${a.name ? '' : 'italic'}`}
							onclick={async () => {
								if (a.signedIn || !a.ms) {
									updateLocalCache((lc) => ({
										...lc,
										accounts: [a, ...lc.accounts.filter((acc) => acc.ms !== a.ms)],
									}));
									refreshCurrentAccount();
								} else {
									goto('/sign-in', { state: { email: a.email } });
								}
							}}
						>
							{#if !i}
								<div class="absolute left-0 h-10 w-0.5 bg-hl1"></div>
							{/if}
							<div class="self-center xy h-6 w-6">
								<AccountIcon isUser ms={a.ms} class="h-6 w-6" />
							</div>
							<!-- TODO: getNameByAccountMs -->
							<div class="flex-1 overflow-scroll text-nowrap fx justify-start">
								{a.ms === 0 ? m.anon() : a.name || identikana(a.ms)}
							</div>
							{#if a.ms && !a.signedIn}
								<p class="group-hover:hidden text-nowrap text-fg2 self-center text-sm">
									{m.signedOut()}
								</p>
							{/if}
						</button>
						{#if a.ms}
							<button
								class={`${0 === i && a.signedIn ? '' : 'pointer-fine:hidden'} group-hover:flex xy w-8 hover:bg-bg7 text-fg2 hover:text-fg1`}
								onclick={(e) => {
									e.stopPropagation();
									(a.signedIn ? signOut : unsaveAccount)(a.ms);
								}}
							>
								{#if a.signedIn}
									<IconLogout class="h-5 w-5" />
								{:else}
									<IconX class="h-5 w-5" />
								{/if}
							</button>
						{/if}
					</div>
				{/each}
			{:else if gs.accounts}
				<div
					id="mindapp-extension"
					class={`flex text-black font-semibold bg-hl1 hover:bg-hl2 ${hideExtensionLink ? 'hidden' : ''}`}
				>
					<a
						target="_blank"
						href="https://chromewebstore.google.com/detail/mindapp/cjhokcciiimochdgkicpifkkhndegkep?authuser=0&hl=en"
						class="truncate flex-1 h-12 fx pl-2 gap-2 font-medium leading-4.5"
					>
						<IconPuzzle class="shrink-0 w-6" />
						<p class="truncate">{m.extension()}</p>
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
				<!-- <div class="h-10 flex">
						<a href="/contacts" class="flex-1 xy hover:bg-bg5">
							<IconAddressBook />
						</a>
					</div> -->
				<a
					href="/add-space"
					class={`fx shrink-0 h-10 px-2 gap-2 font-medium hover:bg-bg5 ${page.url.pathname === '/add-space' ? 'bg-bg5' : ''}`}
				>
					<IconSquarePlus2 class="shrink-0 w-6" />
					<p class="truncate">{m.addSpace()}</p>
				</a>
				{#each sidebarSpaces as space (space.ms)}
					<div
						class={`flex group/space ${space.ms === idParamObj?.in_ms ? 'bg-bg5' : ''} hover:bg-bg5`}
					>
						<a
							href={`/__${space.ms}`}
							class={`relative flex-1 fx h-10 pl-2 gap-2 truncate font-medium`}
						>
							{#if space.ms === gs.currentSpaceMs}
								<div
									class={`absolute left-0 h-full w-0.5 ${page.params.id ? 'bg-hl1' : 'bg-fg2'}`}
								></div>
							{/if}
							<SpaceIcon ms={space.ms} class="shrink-0 w-6" />
							<p class="truncate">{spaceMsToName(space.ms)}</p>
						</a>
						<!-- TODO: IconCalendar -->
						<a
							href={`/__${space.ms}/tags`}
							class={`xy w-8 group-hover/space:flex hover:bg-bg7 hover:text-fg1 ${space.ms !== gs.currentSpaceMs ? 'pointer-fine:hidden' : ''} ${page.url.pathname === `/__${space.ms}/tags` ? 'bg-bg7 text-fg1' : 'text-fg2'}`}
						>
							<IconTags class="h-5" />
						</a>
						<a
							href={`/__${space.ms}/dots`}
							class={`xy w-8 group-hover/space:flex hover:bg-bg7 hover:text-fg1 ${space.ms !== gs.currentSpaceMs ? 'pointer-fine:hidden' : ''} ${page.url.pathname === `/__${space.ms}/dots` ? 'bg-bg7 text-fg1' : 'text-fg2'}`}
						>
							<IconDotsVertical class="h-5" />
						</a>
					</div>
				{/each}
			{/if}
			<div class="flex-1" onclick={(e) => e.stopPropagation()}></div>
			<div class={`${showAccountMenu ? '' : 'hidden xs:block'}`}>
				<a
					href="/user-guide"
					class={`fx shrink-0 h-10 px-2 gap-2 font-medium hover:bg-bg5 ${page.url.pathname === '/user-guide' ? 'bg-bg5' : ''}`}
				>
					<IconHelpSquareRounded class="shrink-0 w-6" />
					<p class="truncate">{m.userGuide()}</p>
				</a>
				<a
					href="/settings"
					class={`fx shrink-0 h-10 px-2 gap-2 font-medium hover:bg-bg5 ${page.url.pathname === '/settings' ? 'bg-bg5' : ''}`}
				>
					<IconSettings class="shrink-0 w-6" />
					<p class="truncate">{m.settings()}</p>
				</a>
			</div>
		</div>
	</div>
</aside>
