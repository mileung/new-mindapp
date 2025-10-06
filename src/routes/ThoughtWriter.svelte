<script lang="ts">
	import { unsaveTagInPersona } from '$lib/types/accounts';
	import { textInputFocused } from '$lib/dom';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import type { ThoughtSelect } from '$lib/types/thoughts';
	import { IconArrowUp, IconCircleXFilled, IconX } from '@tabler/icons-svelte';
	import { matchSorter } from 'match-sorter';
	import { onMount } from 'svelte';

	let bodyTa: HTMLTextAreaElement;
	let tagsIpt: HTMLInputElement;

	let p: {
		toId?: string;
		thought?: ThoughtSelect;
		onSubmit: (tags: string[], body: string) => void;
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
	let allTagsSet = $derived(new Set(gs.accounts ? gs.accounts[0].allTags : []));
	let suggestedTags = $derived.by(() => {
		if (!suggestingTags) return [];
		let filter = tagFilter.replace(/\s+/g, ' ');
		let arr = matchSorter([...allTagsSet], filter)
			.slice(0, 99)
			.concat(tagFilter);
		return [...new Set(arr)];
	});

	$effect(() => {
		suggestingTags = tagsIptFocused ? !!gs.writerTagVal : false;
	});
	$effect(() => {
		if (['to', 'edit'].includes(gs.writerMode[0])) tagsIpt.focus();
	});
	$effect(() => {
		if (gs.writerMode[0] === 'edit') {
			let t = gs.thoughts[gs.writerMode[1]];
			gs.writerTags = t?.tags || [];
			gs.writerBody = t?.body || '';
		}
	});

	onMount(() => {
		tagsIpt.focus();
		window.addEventListener('keydown', (e) => {
			gs.writerMode &&
				!tagsIptFocused &&
				!textInputFocused() &&
				!e.altKey &&
				(!e.ctrlKey || (e.ctrlKey && e.key === 'v')) &&
				(!e.metaKey || (e.metaKey && e.key === 'v')) &&
				((e.key.length === 1 && e.key !== '/') ||
					['Backspace', 'Delete', 'Space'].includes(e.key)) &&
				tagsIpt.focus();
		});
	});

	let submit = () => {
		let otherTag = (suggestingTags && suggestedTags[tagIndex]) || gs.writerTagVal.trim();
		p.onSubmit([...gs.writerTags, ...(otherTag ? [otherTag] : [])], gs.writerBody);
		tagsIpt.blur();
		bodyTa.blur();
		gs.writerTags = [];
		gs.writerTagVal = '';
		gs.writerBody = '';
	};

	let addTag = (tagToAdd?: string) => {
		tagToAdd = tagToAdd || suggestedTags[tagIndex] || tagFilter;
		if (tagToAdd) {
			gs.writerTags = [...new Set([...gs.writerTags, tagToAdd])];
			gs.writerTagVal = '';
		}
	};
</script>

<!-- TODO: draggable height -->
<div class="">
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
	<input
		bind:this={tagsIpt}
		bind:value={gs.writerTagVal}
		autocomplete="off"
		class="bg-bg4 w-full px-2 h-9 text-lg"
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
				if (xFocused) unsaveTagInPersona(suggestedTags[tagIndex]);
				else e.metaKey ? submit() : addTag();
			}
			if (suggestingTags) {
				if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp') {
					if (e.key === 'Tab' && (!suggestedTags.length || tagIndex < 0)) return;
					e.preventDefault();
					if (tagIndex >= 0) {
						if (e.key === 'Tab') {
							xFocused = !xFocused;
							if (!xFocused) return;
						} else xFocused = false;
					} else if (writtenTags.length) {
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
						if (allTagsSet.has(suggestedTags[tagIndex])) {
							if (xFocused) return bodyTa.focus();
						} else return bodyTa.focus();
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
	<div class="relative h-28">
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
					{#if allTagsSet.has(tag)}
						<button
							bind:this={unsaveTagXRefs[i]}
							class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex xy h-8 w-8 hover:bg-bg7 text-fg2 hover:text-fg1 ${xFocused && tagIndex === i ? 'border-2 border-hl1' : ''}`}
							onclick={() => unsaveTagInPersona(tag)}
						>
							<IconX class="h-5 w-5" />
						</button>
					{/if}
				</div>
			{/each}
		</div>
		<textarea
			bind:this={bodyTa}
			bind:value={gs.writerBody}
			placeholder={m.shareThought()}
			class="bg-bg3 h-full resize-none block w-full px-2 py-0.5 text-lg pr-11"
			onkeydown={(e) => {
				e.key === 'Escape' && setTimeout(() => bodyTa.blur(), 0);
				e.metaKey && e.key === 'Enter' && submit();
			}}
		></textarea>
		{#if gs.writerBody}
			<button class="xy bg-hl1 h-8 w-8 absolute bottom-1 right-1 text-black" onclick={submit}>
				<IconArrowUp class="h-9 w-9" />
			</button>
		{/if}
	</div>
</div>
