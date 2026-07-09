<script lang="ts">
	import {
		getPostWriterHeight,
		scrollToHighlight,
		setGlobalCssVariable,
		textInputFocused,
	} from '$lib/dom';
	import {
		getSpacePermissions,
		gs,
		msToSpaceNameTxt,
		resetBottomOverlay,
	} from '$lib/global-state.svelte';

	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { getIdStr, getUrlInMs } from '$lib/types/parts/partIds';
	import { cleanTags, getLastVersion } from '$lib/types/posts';
	import {
		IconArrowUp,
		IconCircleXFilled,
		IconGripVertical,
		IconMessage2Plus,
		IconPencil,
		IconPencilPlus,
		IconX,
	} from '@tabler/icons-svelte';
	import { matchSorter } from 'match-sorter';
	import { onMount } from 'svelte';
	import Highlight from './Highlight.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let coreTa: HTMLTextAreaElement;
	let tagsIpt: HTMLInputElement;
	let draggingHeight: boolean;
	let dragStartY: number;
	let startHeight: number;
	let p: {
		onSubmit: (tags: string[], core: string) => void;
	} = $props();

	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let undoTagRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let tagsIptFocused = $state(false);
	let tagIndex = $state(0);
	let xFocused = $state(false);
	let suggestingTags = $state(false);

	let postingInMs = $derived.by(
		() => (gs.writingReplyTo || gs.writingEditFor)?.in_ms ?? getUrlInMs(),
	);
	let postingInSpaceName = $derived(postingInMs === undefined ? '' : msToSpaceNameTxt(postingInMs));
	let { canPost } = $derived(getSpacePermissions(postingInMs));
	$effect(() => {
		if (!canPost) gs.writingNewPost = gs.writingReplyTo = gs.writingEditFor = null;
	});

	let tagFilter = $derived(gs.writerTagVal.trim());
	let savedTagsSet = $derived(
		new Set(
			gs.accounts //
				? (JSON.parse(gs.accounts[0].savedTags.txt) as string[])
				: [],
		),
	);
	let suggestedTags = $derived.by(() => {
		if (!suggestingTags) return [];
		let filter = tagFilter.replace(/\s+/g, ' ');
		let includeAtTags = filter.startsWith('@');
		let arr = matchSorter(
			[...savedTagsSet].filter((t) => (includeAtTags ? true : !t.startsWith('@'))),
			filter,
		)
			.slice(0, 88)
			.concat(tagFilter);
		return [...new Set(arr)];
	});

	$effect(() => {
		suggestingTags = tagsIptFocused ? !!gs.writerTagVal : false;
	});
	$effect(() => {
		if (gs.writingNewPost || gs.writingReplyTo || gs.writingEditFor) tagsIpt.focus();
	});
	$effect(() => {
		if (gs.writingEditFor) {
			let post = gs.idToPostMap[getIdStr(gs.writingEditFor)]!;
			if (post.history !== null) {
				let lastHistory = post.history[getLastVersion(post)!];
				gs.writerTags = lastHistory?.tags || [];
				gs.writerCore = lastHistory?.core ?? '';
			}
		}
	});

	onMount(() => {
		tagsIpt.focus();
		let onKeyDown = (e: KeyboardEvent) => {
			(gs.writingNewPost || gs.writingReplyTo || gs.writingEditFor) &&
				!tagsIptFocused &&
				!textInputFocused() &&
				!e.altKey &&
				(!e.ctrlKey || (e.ctrlKey && e.key === 'v')) &&
				(!e.metaKey || (e.metaKey && e.key === 'v')) &&
				((e.key.length === 1 && e.key !== '/') ||
					['Backspace', 'Delete', 'Space'].includes(e.key)) &&
				tagsIpt.focus();
		};

		let onDrag = (clientY: number) => {
			if (!draggingHeight) return;
			let deltaY = dragStartY - clientY;
			let newHeight = Math.min(window.innerHeight - 100, Math.max(180, startHeight + deltaY));
			setGlobalCssVariable('--h-post-writer', `${newHeight}px`);
		};
		let onMouseMove = (e: MouseEvent) => onDrag(e.clientY);
		let onTouchMove = (e: TouchEvent) => {
			if (draggingHeight) {
				e.preventDefault(); // Stops page scrolling
				let touch = e.touches[0];
				onDrag(touch.clientY);
			}
		};
		let onDragEnd = () => (draggingHeight = false);

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onDragEnd);
		window.addEventListener('touchmove', onTouchMove, { passive: false }); // passive: false needed for preventDefault to work
		window.addEventListener('touchend', onDragEnd);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onDragEnd);
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('touchend', onDragEnd);
		};
	});

	let submit = () => {
		if (!canPost) return;
		let otherTag = (suggestingTags && suggestedTags[tagIndex]) || gs.writerTagVal.trim();
		p.onSubmit(
			cleanTags([...gs.writerTags, ...(otherTag ? [otherTag] : [])], true),
			gs.writerCore.trim(),
		);
	};

	let addTag = (tagToAdd?: string) => {
		tagToAdd = tagToAdd || suggestedTags[tagIndex] || tagFilter;
		if (tagToAdd) {
			gs.writerTags = [...new Set([...gs.writerTags, tagToAdd])];
			gs.writerTagVal = '';
			setTimeout(() => {
				undoTagRefs.at(-1)?.scrollIntoView();
			}, 0);
		}
	};

	let alteredInitialVal = $state(false);
	let handleBeforeUnload = (event: BeforeUnloadEvent) => {
		console.log('handleBeforeUnload');
		if (
			alteredInitialVal &&
			(gs.writerCore || gs.writerTagVal || gs.writerTags.length) &&
			(gs.writingNewPost || gs.writingReplyTo || gs.writingEditFor)
		) {
			event.preventDefault();
			event.returnValue = '';
		}
	};
</script>

<svelte:window on:beforeunload={handleBeforeUnload} />

<div class="h-[var(--h-post-writer)] flex flex-col">
	<div class="flex group bg-bg4 relative w-full">
		<!-- TODO: save writer data so it persists after page refresh. If the post it's editing or linking to is not on the feed, open it in a modal? -->
		{#if postingInMs !== undefined}
			<button
				class="flex-1 h-8 pl-2 fx gap-1 text-left text-nowrap overflow-scroll hover:bg-bg7 hover:text-fg3"
				onclick={() => {
					let post = gs.writingEditFor || gs.writingReplyTo;
					if (post) {
						let postIdStr = getIdStr(post);
						scrollToHighlight(postIdStr, true);
					}
				}}
			>
				{#if gs.writingReplyTo}
					<IconMessage2Plus class="w-5" />
				{:else if gs.writingNewPost}
					<IconPencilPlus class="w-5" />
				{:else}
					<IconPencil class="w-5" />
				{/if}
				<p class="">
					{gs.writingReplyTo ? m.replyingIn() : gs.writingNewPost ? m.newPostIn() : m.editingIn()}
				</p>
				<SpaceIcon ms={postingInMs} class="h-5 w-5" />
				<p class="flex-1">{postingInSpaceName}</p>
			</button>
		{/if}
		<button
			class="w-8 xy hover:bg-bg7 hover:text-fg3"
			onclick={() => {
				// TODO: cycle through main post, flattened at posts, and cited posts
				resetBottomOverlay();
			}}
		>
			<IconX class="w-5" />
		</button>
		<Highlight
			noScrollId
			postIdStr={gs.writingReplyTo
				? getIdStr(gs.writingReplyTo)
				: gs.writingEditFor
					? getIdStr(gs.writingEditFor)
					: ''}
		/>
	</div>
	<div class="flex-1 relative flex flex-col">
		<div
			tabindex="-1"
			class={`bg-bg3 fx px-2 py-0.5 gap-1 overflow-scroll ${gs.writerTags.length ? '' : 'hidden'}`}
			onclick={() => tagsIpt.focus()}
			onmousedown={(e) => e.preventDefault()}
		>
			{#each gs.writerTags as tag, i}
				<div class="fx">
					<p class="whitespace-pre">{tag}</p>
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
							alteredInitialVal = true;
							gs.writerTags = gs.writerTags.filter((t) => t !== tag);
							if (!gs.writerTags.length) tagsIpt.focus();
							else if (e.shiftKey) undoTagRefs[i - 1]?.focus();
						}}
					>
						<IconCircleXFilled class="w-4 h-4" />
					</button>
				</div>
			{/each}
		</div>
		<input
			bind:this={tagsIpt}
			bind:value={gs.writerTagVal}
			maxlength={88}
			autocomplete="off"
			class="h-9 px-2 text-lg bg-bg4 hover:bg-bg6"
			placeholder={m.tags()}
			onfocus={() => (tagsIptFocused = true)}
			onblur={(e) => (tagsIptFocused = false)}
			onchange={() => (alteredInitialVal = true)}
			oninput={() => {
				tagIndex = 0;
				xFocused = false;
				tagSuggestionsRefs[0]?.focus();
				tagsIpt.focus();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					suggestingTags
						? (suggestingTags = false) //
						: setTimeout(() => tagsIpt.blur(), 0);
				}
				if (e.key === 'Enter') {
					if (xFocused) {
						updateSavedTags([], [suggestedTags[tagIndex]]);
						xFocused = false;
					} else if (e.metaKey) submit();
					else addTag();
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
						} else if (gs.writerTags.length && e.key === 'Tab') {
							return undoTagRefs
								.filter((r) => !!r)
								.at(-1)
								?.focus();
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
		<div class="flex-1 relative">
			<div
				class={`z-30 bg-bg4 flex flex-col overflow-scroll absolute inset-0 w-full backdrop-blur-md max-h-full ${
					suggestingTags ? '' : 'hidden'
				}`}
				onmousedown={(e) => e.preventDefault()}
			>
				{#each suggestedTags as tag, i}
					<div class={`group/tag fx hover:bg-bg7 ${tagIndex === i ? 'bg-bg7' : ''}`}>
						{#if tagIndex === i && !xFocused}
							<div class="absolute z-10 h-8 w-0.5 bg-hl1 group-hover/tag:bg-hl2"></div>
						{/if}
						<button
							bind:this={tagSuggestionsRefs[i]}
							class={`flex w-full relative h-8 flex-1 px-2 text-lg ${gs.writerTags.includes(tag) ? 'text-fg2' : ''}`}
							onclick={() => addTag(tag)}
						>
							<div class="flex-1 text-left text-nowrap overflow-scroll">
								<p class="whitespace-pre">{tag}</p>
							</div>
						</button>
						{#if savedTagsSet.has(tag)}
							<button
								bind:this={unsaveTagXRefs[i]}
								class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex xy h-8 w-8 hover:bg-bg7 text-fg2 hover:text-fg1 ${xFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
								onclick={() => {
									xFocused = false;
									updateSavedTags([], [tag]);
								}}
							>
								<IconX class="h-5 w-5" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
			<div class="h-full flex">
				<textarea
					bind:this={coreTa}
					bind:value={gs.writerCore}
					maxlength={888888}
					placeholder={m.core()}
					onchange={() => (alteredInitialVal = true)}
					class="resize-none flex-1 text-lg p-2 pr-9 bg-bg3 hover:bg-bg6"
					onkeydown={(e) => {
						e.key === 'Escape' && setTimeout(() => tagsIpt.focus(), 0);
						e.metaKey && e.key === 'Enter' && submit();
					}}
				>
				</textarea>
				<div
					class="-top-8.5 right-0 absolute xy h-8 w-8 cursor-grab active:cursor-grabbing hover:text-fg3"
					ontouchstart={(e) => {
						draggingHeight = true;
						dragStartY = e.changedTouches[0].clientY;
						startHeight = getPostWriterHeight();
					}}
					onmousedown={(e) => {
						e.preventDefault();
						draggingHeight = true;
						dragStartY = e.clientY;
						startHeight = getPostWriterHeight();
					}}
				>
					<IconGripVertical class="w-5" />
				</div>
				{#if canPost}
					<button
						class={`absolute bottom-0 right-0 xy h-8 w-8 text-bg1 bg-fg1 hover:bg-fg3 border-b-2 border-hl1 hover:border-hl2`}
						onclick={submit}
					>
						<IconArrowUp class="h-8 w-8" />
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
