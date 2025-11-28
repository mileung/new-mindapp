<script lang="ts">
	import { textInputFocused } from '$lib/dom';
	import { gs } from '$lib/global-state.svelte';

	import { m } from '$lib/paraglide/messages';
	import { unsaveTagInCurrentAccount } from '$lib/types/local-cache';
	import { type PartSelect } from '$lib/types/parts';
	import { getLastVersion, normalizeTags, scrollToHighlight } from '$lib/types/posts';
	import {
		IconArrowUp,
		IconCircleXFilled,
		IconCornerUpLeft,
		IconGripVertical,
		IconMoodPlus,
		IconPencil,
		IconPencilPlus,
		IconX,
	} from '@tabler/icons-svelte';
	import { matchSorter } from 'match-sorter';
	import { onMount } from 'svelte';
	import Highlight from './Highlight.svelte';
	import { getIdStr } from '$lib/types/parts/partIds';

	let coreTa: HTMLTextAreaElement;
	let tagsIpt: HTMLInputElement;
	let draggingHeight: boolean;
	let startY: number;
	let startHeight: number;
	let p: {
		thought?: PartSelect;
		onSubmit: (tags: string[], core: string) => void;
	} = $props();

	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let undoTagRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let tagsIptFocused = $state(false);
	let tagIndex = $state(0);
	let xFocused = $state(false);
	let suggestingTags = $state(false);

	let writtenTags = $derived(gs.writerTags.filter((t) => t[0] !== ' '));
	let tagFilter = $derived(gs.writerTagVal.trim());
	let savedTagsSet = $derived(new Set(gs.accounts ? gs.accounts[0].savedTags : []));
	let suggestedTags = $derived.by(() => {
		if (!suggestingTags) return [];
		let filter = tagFilter.replace(/\s+/g, ' ');
		let arr = matchSorter([...savedTagsSet], filter)
			.slice(0, 99)
			.concat(tagFilter);
		return [...new Set(arr)];
	});

	$effect(() => {
		suggestingTags = tagsIptFocused ? !!gs.writerTagVal : false;
	});
	$effect(() => {
		if (gs.writingNew || gs.writingTo || gs.writingEdit) tagsIpt.focus();
	});
	$effect(() => {
		if (gs.writingEdit) {
			let post = gs.idToPostMap[getIdStr(gs.writingEdit)]!;
			if (post.history !== null) {
				let lastHistory = post.history[getLastVersion(post)!];
				gs.writerTags = lastHistory?.tags || [];
				gs.writerCore = lastHistory?.core || '';
			}
		}
	});

	onMount(() => {
		tagsIpt.focus();
		let onKeyDown = (e: KeyboardEvent) => {
			(gs.writingNew || gs.writingTo || gs.writingEdit) &&
				!tagsIptFocused &&
				!textInputFocused() &&
				!e.altKey &&
				(!e.ctrlKey || (e.ctrlKey && e.key === 'v')) &&
				(!e.metaKey || (e.metaKey && e.key === 'v')) &&
				((e.key.length === 1 && e.key !== '/') ||
					['Backspace', 'Delete', 'Space'].includes(e.key)) &&
				tagsIpt.focus();
		};

		let onMouseMove = (moveEvent: MouseEvent) => {
			if (draggingHeight) {
				let deltaY = startY - moveEvent.clientY;
				let newHeight = Math.min(window.innerHeight - 100, Math.max(133, startHeight + deltaY));
				document.documentElement.style.setProperty('--h-post-writer', `${newHeight}px`);
			}
		};

		let onMouseUp = () => (draggingHeight = false);

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		};
	});

	let submit = () => {
		let otherTag = (suggestingTags && suggestedTags[tagIndex]) || gs.writerTagVal.trim();
		p.onSubmit(
			normalizeTags([...gs.writerTags, ...(otherTag ? [otherTag] : [])]),
			gs.writerCore.trim(),
		);
		tagsIpt.blur();
		coreTa.blur();
		gs.writerTags = [];
		gs.writerTagVal = '';
		gs.writerCore = '';
	};

	let addTag = (tagToAdd?: string) => {
		tagToAdd = tagToAdd || suggestedTags[tagIndex] || tagFilter;
		if (tagToAdd) {
			gs.writerTags = [...new Set([...gs.writerTags, tagToAdd])];
			gs.writerTagVal = '';
		}
	};

	let highlightedPostLastCore = $derived.by(() => {
		let post = gs.writingTo || gs.writingEdit;
		if (post) {
			let highlightedPost = gs.idToPostMap[getIdStr(post)];
			return highlightedPost?.history?.[getLastVersion(highlightedPost)!]?.core;
		}
	});
</script>

<div class="h-[var(--h-post-writer)] flex flex-col">
	<div class="flex group bg-bg4 relative w-full">
		<!-- TODO: save writer data so it persists after page refresh. If the post it's editing or linking to is not on the feed, open it in a modal? -->
		<button
			class="truncate flex-1 h-8 pl-2 text-left fx gap-1"
			onclick={() => {
				let post = gs.writingEdit || gs.writingTo;
				post && scrollToHighlight(getIdStr(post));
			}}
		>
			{#if gs.writingTo}
				<IconCornerUpLeft class="w-5" />
			{:else if gs.writingNew}
				<IconPencilPlus class="w-5" />
			{:else}
				<IconPencil class="w-5" />
			{/if}
			<p class="flex-1 truncate">
				{gs.writingNew ? m.newPost() : highlightedPostLastCore}
			</p>
		</button>
		<!-- TODO: reactions stuff -->
		<!-- {#if gs.writingTo}
			{#each reactionList.slice(0, 4) as emoji}
				<button
					class="text-lg w-8 xy grayscale-100 hover:grayscale-0 hover:bg-bg7"
					onclick={() => {
						console.log(emoji);
					}}
				>
					{emoji}
				</button>
			{/each}
		{/if}
		<button class="w-8 xy hover:bg-bg8 hover:text-fg3">
			<IconMoodPlus class="w-5" />
		</button> -->
		<button
			class="w-8 xy hover:bg-bg7 hover:text-fg3"
			onclick={() => (gs.writingNew = gs.writingTo = gs.writingEdit = false)}
		>
			<IconX class="w-5" />
		</button>
		<Highlight
			id={gs.writingTo ? getIdStr(gs.writingTo) : gs.writingEdit ? getIdStr(gs.writingEdit) : ''}
		/>
	</div>
	<div
		tabindex="-1"
		class={`bg-bg3 fx flex-wrap px-2 py-0.5 gap-1 ${writtenTags.length ? '' : 'hidden'}`}
		onclick={() => tagsIpt.focus()}
		onmousedown={(e) => e.preventDefault()}
	>
		{#each writtenTags as tag, i}
			<div class="fx">
				{tag}
				<button
					class="xy -ml-0.5 h-7 w-7 text-fg2 hover:text-fg1"
					bind:this={undoTagRefs[i]}
					onkeydown={(e) => {
						if (e.key === 'Backspace') {
							e.preventDefault();
							undoTagRefs[i]?.click();
						}
					}}
					onclick={(e) => {
						e.stopPropagation(); // this is needed to focus the next tag
						gs.writerTags = gs.writerTags.filter((t) => t !== tag);
						if (!writtenTags.length) tagsIpt.focus();
					}}
				>
					<IconCircleXFilled class="w-4 h-4" />
				</button>
			</div>
		{/each}
	</div>
	<div class="relative flex bg-bg4 h-9">
		<input
			bind:this={tagsIpt}
			bind:value={gs.writerTagVal}
			autocomplete="off"
			class="flex-1 pl-2 pr-9 text-lg"
			placeholder={m.tags()}
			onfocus={() => (tagsIptFocused = true)}
			onblur={(e) => (tagsIptFocused = false)}
			onpaste={(e) => {
				let pastedText = e.clipboardData?.getData('text') || '';
				let pastedTags = pastedText.split(/\r?\n/);
				if (pastedTags.length > 1) {
					gs.writerTags = gs.writerTags.concat(
						pastedTags.map((t) => t.trim()).filter((t) => !!t && !gs.writerTags.includes(t)),
					);
				}
			}}
			oninput={() => {
				tagIndex = 0;
				xFocused = false;
				tagSuggestionsRefs[0]?.focus();
				tagsIpt.focus();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					if (suggestingTags) {
						suggestingTags = false;
					} else setTimeout(() => tagsIpt.blur(), 0);
				}
				if (e.key === 'Enter') {
					if (xFocused) unsaveTagInCurrentAccount(suggestedTags[tagIndex]);
					else e.metaKey ? submit() : addTag();
				}
				if (suggestingTags) {
					if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp') {
						if (e.key === 'Tab' && (!suggestedTags.length || (tagIndex <= 0 && !xFocused))) return;
						e.preventDefault();
						// TODO: on up arrow and can't go up anymore, go to beginning of line
						// TODO: on down arrow and can't go down anymore, go to end of line
						if (tagIndex >= 0) {
							if (e.key === 'Tab') {
								xFocused = !xFocused;
								if (!xFocused) return;
							} else xFocused = false;
						} else if (writtenTags.length && e.key === 'Tab') {
							return undoTagRefs
								.filter((r) => !!r)
								.slice(-1)[0]
								.focus();
						}

						let index = Math.max(tagIndex - 1, -1);
						tagSuggestionsRefs[index]?.focus();
						tagIndex = index;
						tagsIpt.focus();
					}
					if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown') {
						e.preventDefault();
						if (e.key === 'Tab' && tagIndex === suggestedTags.length - 1) {
							if (savedTagsSet.has(suggestedTags[tagIndex])) {
								if (xFocused) return coreTa.focus();
							} else return coreTa.focus();
						}
						if (e.key === 'Tab' && !xFocused && tagIndex > -1) {
							xFocused = true;
						} else {
							xFocused = false;
							let index = Math.min(tagIndex + 1, suggestedTags.length - 1);
							tagSuggestionsRefs[index]?.focus();
							tagIndex = index;
						}
						tagsIpt.focus();
					}
				}
			}}
		/>
		<div
			class="absolute right-0 h-full w-8 xy cursor-grab group active:cursor-grabbing hover:text-fg3"
			onmousedown={(e) => {
				e.preventDefault();
				draggingHeight = true;
				startY = e.clientY;
				startHeight = parseFloat(
					getComputedStyle(document.documentElement).getPropertyValue('--h-post-writer'),
				);
			}}
		>
			<div class="xy h-8 w-7 group-hover:bg-bg5">
				<IconGripVertical class="w-5" />
			</div>
		</div>
	</div>
	<div class="flex-1">
		<div
			class={`bg-bg3 flex flex-col overflow-scroll absolute w-full backdrop-blur-md max-h-full shadow ${
				suggestingTags ? '' : 'hidden'
			}`}
			onmousedown={(e) => e.preventDefault()}
		>
			{#each suggestedTags as tag, i}
				<div class={`group/tag fx hover:bg-bg5 ${tagIndex === i ? 'bg-bg5' : ''}`}>
					<button
						bind:this={tagSuggestionsRefs[i]}
						class={`relative h-8 truncate flex-1 text-left px-2 text-nowrap text-lg`}
						onclick={() => addTag(tag)}
					>
						{#if tagIndex === i && !xFocused}
							<div class="absolute left-0 top-0 bottom-0 w-0.5 bg-hl1 group-hover/tag:bg-hl2"></div>
						{/if}
						{tag}
					</button>
					{#if savedTagsSet.has(tag)}
						<button
							bind:this={unsaveTagXRefs[i]}
							class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex xy h-8 w-8 hover:bg-bg7 text-fg2 hover:text-fg1 ${xFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
							onclick={() => unsaveTagInCurrentAccount(tag)}
						>
							<IconX class="h-5 w-5" />
						</button>
					{/if}
				</div>
			{/each}
		</div>
		<textarea
			bind:this={coreTa}
			bind:value={gs.writerCore}
			placeholder={m.organizeToday()}
			class="bg-bg3 h-full resize-none block w-full px-2 py-0.5 text-lg pr-10"
			onkeydown={(e) => {
				e.key === 'Escape' && setTimeout(() => coreTa.blur(), 0);
				e.metaKey && e.key === 'Enter' && submit();
			}}
		></textarea>
		<button
			class="absolute xy right-1 bottom-1 h-8 w-8 text-bg1 bg-fg1 hover:bg-fg3"
			onclick={submit}
		>
			<IconArrowUp class="h-9 w-9" />
		</button>
	</div>
</div>
