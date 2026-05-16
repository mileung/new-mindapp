<script lang="ts">
	import { getPostWriterHeight, scrollToHighlight, textInputFocused } from '$lib/dom';
	import {
		getSpaceContext,
		gs,
		msToSpaceNameTxt,
		resetBottomOverlay,
	} from '$lib/global-state.svelte';

	import { goto } from '$app/navigation';
	import { getTagVal, is1Emoji } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { getIdObj, getIdStr, getUrlInMs } from '$lib/types/parts/partIds';
	import { getLastVersion, normalizeTag, normalizeTags } from '$lib/types/posts';
	import { shortReactionList } from '$lib/types/reactions/reactionList';
	import { toggleReaction } from '$lib/types/reactions/toggleReaction';
	import { permissionCodes } from '$lib/types/spaces';
	import {
		IconArrowUp,
		IconCircleXFilled,
		IconGripVertical,
		IconHandStop,
		IconMessage2Plus,
		IconMoodPlus,
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
	let startY: number;
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
	let typedEmoji = $state('');
	let showAllEmojis = $state(false); // TODO:

	let writingToMyRxnEmojis = $derived(gs.writingTo?.myRxnEmojis || []);
	let writingInMs = $derived((gs.writingTo || gs.writingEdit)?.in_ms || getUrlInMs()!);
	let writingInSpaceName = $derived(msToSpaceNameTxt(writingInMs));
	let writingInMsPermissionCodeNum = $derived(getSpaceContext(writingInMs)?.permissionCode.num);
	let canReactAndPost = $derived(writingInMsPermissionCodeNum === permissionCodes.reactAndPost);
	let canReact = $derived(
		canReactAndPost || writingInMsPermissionCodeNum === permissionCodes.reactOnly,
	);
	let canPost = $derived(
		canReactAndPost || writingInMsPermissionCodeNum === permissionCodes.postOnly,
	);
	let showGoToDifferentSpace = $derived(
		!canPost && !!(gs.writingNew || gs.writerCore || gs.writerTags.length || gs.writerTagVal),
	);
	let reactEmojiOptions = $derived([
		...writingToMyRxnEmojis.filter((e) => !shortReactionList.includes(e)),
		...shortReactionList,
		...Object.entries(gs.writingTo?.rxnEmojiCount || {})
			.filter(([e]) => !shortReactionList.includes(e) && !writingToMyRxnEmojis.includes(e))
			.sort((a, b) => b[1] - a[1])
			.map(([e]) => e),
	]);
	let tagFilter = $derived(normalizeTag(gs.writerTagVal));
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
		let arr = matchSorter([...savedTagsSet], filter)
			.slice(0, 88)
			.concat(tagFilter);
		return [...new Set(arr)];
	});

	let toggleEmoji = async (emoji: string) => {
		await toggleReaction({
			postIdObj: getIdObj(gs.writingTo!),
			emoji,
		});
	};

	$effect(() => {
		if (typedEmoji && gs.writingTo) {
			is1Emoji(typedEmoji) //
				? toggleEmoji(typedEmoji)
				: alert(m.useYourDevicesEmojiKeyboard());
		}
		typedEmoji = '';
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
			// TODO: touchstart, touchmove, and touchend for mobile web
			if (draggingHeight) {
				let deltaY = startY - moveEvent.clientY;
				let newHeight = Math.min(window.innerHeight - 100, Math.max(188, startHeight + deltaY));
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
		if (!canPost) return;
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
</script>

{#snippet styledTag(tag: string)}
	{#if tag.includes('=')}
		<p class="font-mono whitespace-pre">
			{tag.slice(0, tag.indexOf('='))}<span
				class={typeof getTagVal(tag) === 'string' ? 'text-amber-500' : 'text-emerald-500'}>=</span
			>{tag.slice(tag.indexOf('=') + 1)}
		</p>
	{:else}
		<p class="whitespace-pre">{tag}</p>
	{/if}
{/snippet}

<div class="h-[var(--h-post-writer)] flex flex-col">
	<div class="flex group bg-bg4 relative w-full">
		<!-- TODO: save writer data so it persists after page refresh. If the post it's editing or linking to is not on the feed, open it in a modal? -->
		<button
			class={`flex-1 h-8 pl-2 fx gap-1 text-left text-nowrap overflow-scroll ${showGoToDifferentSpace ? 'pointer-events-none' : 'hover:bg-bg7 hover:text-fg3'}`}
			onclick={() => {
				let post = gs.writingEdit || gs.writingTo;
				if (post) {
					let postIdStr = getIdStr(post);
					getUrlInMs() !== post.in_ms
						? goto(`/${postIdStr}`) //
						: scrollToHighlight(postIdStr);
				}
			}}
		>
			{#if showGoToDifferentSpace}
				<IconHandStop class="w-5" />
			{:else if gs.writingTo}
				<IconMessage2Plus class="w-5" />
			{:else if gs.writingNew}
				<IconPencilPlus class="w-5" />
			{:else}
				<IconPencil class="w-5" />
			{/if}
			<p class="">
				{showGoToDifferentSpace
					? m.goToADifferentSpaceToPost()
					: gs.writingTo
						? m.replyingIn()
						: gs.writingNew
							? m.newPostIn()
							: m.editingIn()}
			</p>
			{#if !showGoToDifferentSpace && (canReact || canPost)}
				<SpaceIcon ms={writingInMs} class="h-5 w-5" />
				<p class="flex-1">{writingInSpaceName}</p>
			{/if}
		</button>
		<!-- TODO: reactions stuff -->
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
			red={showGoToDifferentSpace}
			postIdStr={gs.writingTo
				? getIdStr(gs.writingTo)
				: gs.writingEdit
					? getIdStr(gs.writingEdit)
					: ''}
		/>
	</div>
	<div class={`flex-1 relative flex flex-col ${showAllEmojis ? 'hidden' : ''}`}>
		<div
			tabindex="-1"
			class={`bg-bg3 fx flex-wrap px-2 py-0.5 gap-1 ${gs.writerTags.length ? '' : 'hidden'}`}
			onclick={() => tagsIpt.focus()}
			onmousedown={(e) => e.preventDefault()}
		>
			{#each gs.writerTags as tag, i}
				<div class="fx">
					{@render styledTag(tag)}
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
							if (!gs.writerTags.length) tagsIpt.focus();
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
					suggestingTags
						? (suggestingTags = false) //
						: setTimeout(() => tagsIpt.blur(), 0);
				}
				if (e.key === 'Enter') {
					xFocused
						? updateSavedTags([suggestedTags[tagIndex]], true)
						: e.metaKey
							? submit()
							: addTag();
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
							class={`flex w-full ${tag.includes('=') ? 'font-mono' : ''} relative h-8 flex-1 px-2 text-lg`}
							onclick={() => addTag(tag)}
						>
							<div class="flex-1 text-left text-nowrap overflow-scroll">
								{@render styledTag(tag)}
							</div>
							{#if tag.includes('=')}
								{#if typeof getTagVal(tag) === 'string'}
									<p class="xy text-amber-500">{m.text()}</p>
								{:else}
									<p class="xy text-emerald-500">{m.number()}</p>
								{/if}
							{/if}
						</button>
						{#if savedTagsSet.has(tag)}
							<button
								bind:this={unsaveTagXRefs[i]}
								class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex xy h-8 w-8 hover:bg-bg7 text-fg2 hover:text-fg1 ${xFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
								onclick={() => updateSavedTags([tag], true)}
							>
								<IconX class="h-5 w-5" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
			<div class="h-full">
				<textarea
					bind:this={coreTa}
					bind:value={gs.writerCore}
					maxlength={888888}
					placeholder={m.core()}
					class="resize-none h-full w-full px-2 py-0.5 text-lg pr-9 bg-bg3 hover:bg-bg5"
					onkeydown={(e) => {
						e.key === 'Escape' && setTimeout(() => coreTa.blur(), 0);
						e.metaKey && e.key === 'Enter' && submit();
					}}
				>
				</textarea>
				<div
					class="-top-8.5 right-0 absolute xy h-8 w-8 cursor-grab active:cursor-grabbing hover:text-fg3"
					onmousedown={(e) => {
						e.preventDefault();
						draggingHeight = true;
						startY = e.clientY;
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
	<div
		class={`overflow-scroll w-full flex bg-bg4 ${gs.writingTo && canReact ? '' : 'hidden'} ${showAllEmojis ? 'flex-1 flex-wrap content-start' : 'h-8'}`}
	>
		<div class="h-8 min-w-8 -mr-8 xy">
			<IconMoodPlus class="h-4.5 w-4.5" />
		</div>
		<input bind:value={typedEmoji} class="h-8 w-8 min-w-8" />
		{#each reactEmojiOptions as emoji}
			<button
				class={`h-8 min-w-8 xy hover:bg-bg7 ${writingToMyRxnEmojis.includes(emoji) ? 'border-b-2 border-hl1 hover:border-hl2' : ''}`}
				onclick={() => toggleEmoji(emoji)}
			>
				{emoji}
			</button>
		{/each}
	</div>
</div>
