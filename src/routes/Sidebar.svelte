<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { textInputFocused } from '$lib/dom';
	import { getBottomOverlayShown, gs, resetBottomOverlay } from '$lib/global-state.svelte';
	import { identikana, isTouchScreen } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import {
		signOut,
		unsaveAccount,
		updateLocalCache,
		updateSavedTags,
	} from '$lib/types/local-cache';
	import { bracketRegex } from '$lib/types/posts/getPostFeed';
	import { defaultSpaceProps, spaceMsToNameTxt, type Space } from '$lib/types/spaces';
	import {
		IconBook2,
		IconDotsVertical,
		IconLogout,
		IconPuzzle,
		IconSearch,
		IconSettings,
		IconSquarePlus2,
		IconTags,
		IconUserPlus,
		IconUserSquare,
		IconX,
	} from '@tabler/icons-svelte';
	import { matchSorter } from 'match-sorter';
	import { onMount } from 'svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let searchIpt: HTMLInputElement;
	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);

	let hideExtensionLink = $state(isTouchScreen);
	let searchVal = $state((() => page.url.searchParams.get('q') || '')());

	let searchIptFocused = $state(false);
	let tagXFocused = $state(false);

	let showAccountMenu = $state(false);
	let showSpaceMenu = $state(false);
	let tagIndex = $state(-1);

	let tagFilter = $derived(
		searchVal.trim().replace(bracketRegex, '').replace(/\s\s+/g, ' ').trim(),
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

	onMount(() => {
		let handler = (e: KeyboardEvent) => {
			if (!textInputFocused() && gs.urlInMs !== undefined) {
				// setTimeout prevents inputting '/' on focus
				e.key === '/' && setTimeout(() => searchIpt.focus(), 0);
				e.key === 'a' && (showAccountMenu = !showAccountMenu);
				// TODO: shortcut(s) to switch accounts
				e.key === 'h' && goto(`/__${gs.urlInMs}`);
				e.key === 's' && goto(`/settings`);
				(e.key === 'u' || e.key === '?') && goto(`/user-guide`);
				if (e.key === 'Escape') {
					if (getBottomOverlayShown()) resetBottomOverlay();
					else if (showAccountMenu || showSpaceMenu) showAccountMenu = showSpaceMenu = false;
					else window.scrollTo({ top: 0 });
				}
				if (e.metaKey && e.ctrlKey && e.key === 'Tab' && gs.accounts) {
					let urlInMsIndex = sidebarSpaces.findIndex((s) => s.ms === gs.urlInMs);
					let newSpaceMsIndex = urlInMsIndex + (e.shiftKey ? -1 : 1);
					if (newSpaceMsIndex < 0) newSpaceMsIndex = 0;
					if (newSpaceMsIndex >= sidebarSpaces.length) newSpaceMsIndex = sidebarSpaces.length - 1;
					goto(`/__${sidebarSpaces[newSpaceMsIndex].ms}`);
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

	let sidebarSpaces = $derived<Space[]>([
		// local space ms - everything private in OPFS
		defaultSpaceProps,
		// personal space ms placeholder - everything private in cloud
		{ ...defaultSpaceProps, ms: gs.accounts?.[0].ms || 8 },
		// global space ms - everything public in cloud
		{ ...defaultSpaceProps, ms: 1 },

		// ...(gs.pendingInvite && gs.pendingInvite.in_ms !== 1
		// 	? [
		// 			{
		// 				...defaultSpaceProps,
		// 				ms: gs.pendingInvite.in_ms,
		// 				name: { ms: 0, by_ms: 0, txt: gs.pendingInvite.space.name.txt },
		// 			},
		// 		]
		// 	: []),
		// ...(gs.accounts?.[0].spaceMss || []),
	]);
</script>

<!-- TODO: remember PostDrop states (open, parsed, etc) when switching spaces -->

<aside class="z-50 bottom-0 fixed w-screen xs:h-screen xs:w-[var(--w-sidebar)] bg-bg2">
	<!-- <div
		class="hidden xs:block z-50 absolute right-0 h-screen cursor-col-resize w-0.5 hover:w-4"
		onmousedown={() => {
			// TODO: resizable sidebar. Might be better to just make the whole sidebar draggable.
			// If dragging on button or a tag, disable so it doesn't fire on moue up
			// Or just make the Search Icon draggable? IconGripHorizontal on hover an no text input?
		}}
	></div> -->
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
					<SpaceIcon ms={gs.urlInMs!} class="h-6 w-6" />
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
						if (tagXFocused) updateSavedTags([tag], true);
						else if (tag) addTagToSearchInput(tag);
						else {
							let q = searchVal.trim();
							if (q) {
								let href = `/__${gs.urlInMs}?q=${q}`;
								e.metaKey ? open(href, '_blank') : goto(href);
							}
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
				class={`xy -ml-9 w-9 group ${searchVal ? 'text-fg1 hover:text-fg3' : 'text-fg2 pointer-events-none'}`}
				href={`/__${gs.urlInMs}?q=${searchVal}`}
			>
				<div class={`xy ${searchIptFocused ? 'h-8 w-8' : 'h-9 w-9'} group-hover:bg-bg5`}>
					<IconSearch class="h-6 w-6" />
				</div>
			</a>
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
								onclick={() => {
									updateSavedTags([tag], true);
								}}
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
							onclick={() => {
								a.signedIn || !a.ms
									? updateLocalCache((lc) => ({
											...lc,
											accounts: [a, ...lc.accounts.filter((acc) => acc.ms !== a.ms)],
										}))
									: goto('/sign-in', { state: { email: a.email.txt } });
							}}
						>
							{#if !i}
								<div class="absolute left-0 h-10 w-0.5 bg-hl1"></div>
							{/if}
							<div class="self-center xy h-6 w-6">
								<AccountIcon isUser ms={a.ms} class="h-6 w-6" />
							</div>
							<div class="flex-1 overflow-scroll text-nowrap fx justify-start">
								{a.ms === 0 ? m.anon() : a.name.txt || identikana(a.ms)}
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
				<a
					href="/add-space"
					class={`fx shrink-0 h-10 px-2 gap-2 font-medium hover:bg-bg5 ${page.url.pathname === '/add-space' ? 'bg-bg5' : ''}`}
				>
					<IconSquarePlus2 class="shrink-0 w-6" />
					<p class="truncate">{m.createSpace()}</p>
				</a>
				{#each sidebarSpaces as space (space.ms)}
					<div class={`flex group/space ${space.ms === gs.urlInMs ? 'bg-bg5' : ''} hover:bg-bg5`}>
						<a
							href={`/__${space.ms}`}
							class={`relative flex-1 fx h-10 pl-2 gap-2 truncate font-medium`}
						>
							{#if space.ms === gs.urlInMs}
								<div
									class={`absolute left-0 h-full w-0.5 ${page.params.feedSlug || page.params.spaceSlug ? 'bg-hl1' : 'bg-fg2'}`}
								></div>
							{/if}
							{#if space.ms === gs.urlInMs}
								<div class={`absolute left-0 h-full w-0.5 bg-yellow-300`}></div>
							{/if}
							<SpaceIcon ms={space.ms} class="shrink-0 w-6" />
							<p class="truncate">{spaceMsToNameTxt(space.ms)}</p>
						</a>
						<!-- TODO: IconCalendar -->
						<a
							href={`/__${space.ms}/tags`}
							class={`xy w-8 group-hover/space:flex hover:bg-bg7 hover:text-fg1 ${space.ms !== gs.urlInMs ? 'pointer-fine:hidden' : ''} ${page.url.pathname === `/__${space.ms}/tags` ? 'bg-bg7 text-fg1' : 'text-fg2'}`}
						>
							<IconTags class="h-5" />
						</a>
						<a
							href={`/__${space.ms}/dots`}
							class={`xy w-8 group-hover/space:flex hover:bg-bg7 hover:text-fg1 ${space.ms !== gs.urlInMs ? 'pointer-fine:hidden' : ''} ${page.url.pathname === `/__${space.ms}/dots` ? 'bg-bg7 text-fg1' : 'text-fg2'}`}
						>
							<IconDotsVertical class="h-5" />
						</a>
					</div>
				{/each}
			{/if}
			<div class="flex-1" onclick={(e) => e.stopPropagation()}></div>
			<div class={`${showAccountMenu ? '' : 'hidden xs:block'}`}>
				<a
					href={`/_${gs.accounts?.[0].ms || 0}_`}
					class={`fx shrink-0 h-10 px-2 gap-2 font-medium hover:bg-bg5 ${page.url.pathname === `/_${gs.accounts?.[0].ms}_` ? 'bg-bg5' : ''}`}
				>
					<IconUserSquare class="shrink-0 w-6" />
					<p class="truncate">{m.profile()}</p>
				</a>
				<a
					href="/user-guide"
					class={`fx shrink-0 h-10 px-2 gap-2 font-medium hover:bg-bg5 ${page.url.pathname === '/user-guide' ? 'bg-bg5' : ''}`}
				>
					<IconBook2 class="shrink-0 w-6" />
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
