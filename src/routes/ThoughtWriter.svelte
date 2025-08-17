<script lang="ts">
	import { page } from '$app/state';
	import { isStringifiedRecord } from '$lib/js';
	import type { ThoughtSelect } from '$lib/thoughts';
	import { matchSorter } from 'match-sorter';

	import { gs } from '$lib/globalState.svelte';
	import { m } from '$lib/paraglide/messages';
	import { unsaveTagInPersona } from '$lib/personas';
	import { IconArrowUp, IconCircleXFilled, IconX } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';

	let bodyTa: HTMLTextAreaElement;
	let tagsIpt: HTMLInputElement;
	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let undoTagRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let addedTagsContainerDiv: HTMLDivElement;

	let tagsIptFocused = $state(true);
	let tagVal = $state('');
	let tagIndex = $state(0);
	let xFocused = $state(false);
	let suggestingTags = $state(false);

	$effect(() => {
		// console.log($inspect(tagSuggestionsRefs));
	});

	$effect(() => {
		if (tagsIptFocused) {
			suggestingTags = !!tagVal;
		} else {
			suggestingTags = false;
			xFocused = false;
		}
	});

	let p: {
		thought?: ThoughtSelect;
		initialTags?: string[];
		initialBody?: string;
		onSubmit: (tags: string[], body: string) => void;
	} = $props();

	let jsonParam = $state(
		(() => {
			let json = page.url.searchParams.get('json');
			return json ? (JSON.parse(json) as { body?: string; tags?: string[] }) : null;
		})(),
	);

	let addedTags = $state<string[]>([...(p.initialTags || []), ...(jsonParam?.tags || [])]);
	let bodyVal = $state(
		(() => {
			let body = p.initialBody || jsonParam?.body || '';
			return isStringifiedRecord(body) ? JSON.stringify(JSON.parse(body), null, 2) : body;
		})(),
	);

	let tagFilter = $derived(tagVal.trim());
	let allTagsSet = $derived(new Set(gs.personas[0]?.tags || []));
	let suggestedTags = $derived.by(() => {
		if (!suggestingTags) return [];
		let filter = tagFilter.replace(/\s+/g, ' ');
		let arr = matchSorter([...allTagsSet], filter)
			.slice(0, 99)
			.concat(tagFilter);
		return [...new Set(arr)];
	});

	onMount(() => {
		window.postMessage({ type: 'page-ready' }, '*');
		window.addEventListener('message', (event) => {
			if (event.source !== window) return;
			if (event.data && event.data.type === 'extension-data') {
				let { tags, body } = (event.data.payload.data as { tags?: string[]; body?: string }) || {};
				tags && (addedTags = tags);
				body && (bodyVal = body);
			}
		});
	});

	let submit = () => {
		let otherTag = (suggestingTags && suggestedTags[tagIndex]) || tagVal.trim();
		p.onSubmit([...addedTags, ...(otherTag ? [otherTag] : [])], bodyVal);
		addedTags = [];
		tagVal = '';
		bodyVal = '';
	};

	let addTag = (tagToAdd?: string) => {
		tagToAdd = tagToAdd || suggestedTags[tagIndex] || tagFilter;
		if (tagToAdd) {
			addedTags = [...new Set([...addedTags, tagToAdd])];
			tagVal = '';
		}
	};
	$effect(() => {
		!allTagsSet.size && (xFocused = false);
	});
</script>

<div class="w-full">
	<div
		bind:this={addedTagsContainerDiv}
		tabindex="-1"
		class={`bg-bg4 rounded fx flex-wrap px-2 mb-0.5 py-0.5 gap-1 ${addedTags.length ? '' : 'hidden'}`}
		onclick={() => tagsIpt.focus()}
	>
		{#each addedTags as name, i}
			<div class="fx">
				{name}
				<button
					class="xy -ml-0.5 h-7 w-7 rounded-full -outline-offset-4 transition text-fg2 hover:text-fg1"
					bind:this={undoTagRefs[i]}
					onclick={(e) => {
						e.stopPropagation(); // this is needed to focus the next tag
						addedTags = addedTags.filter((_, index) => index !== i);
						if (!addedTags.length || (i === addedTags.length && !e.shiftKey)) {
							tagsIpt.focus();
						}
					}}
					onkeydown={(e) => {
						if (e.key === 'Backspace') {
							if (undoTagRefs.filter((r) => !!r).slice(-1)[0] === document.activeElement) {
								tagsIpt.focus();
							}
							addedTags = addedTags.filter((_, index) => index !== i);
						} else if (!['Control', 'Alt', 'Tab', 'Shift', 'Meta', 'Enter'].includes(e.key)) {
							tagsIpt.focus();
						}
					}}
					onmouseup={() => {
						setTimeout(() => tagsIpt.focus(), 0);
					}}
				>
					<IconCircleXFilled class="w-4 h-4" />
				</button>
			</div>
		{/each}
	</div>
	<input
		bind:this={tagsIpt}
		bind:value={tagVal}
		autofocus
		autocomplete="off"
		class="bg-bg4 rounded w-full px-2 py-0.5 text-lg"
		placeholder={m.tags()}
		onfocus={() => (tagsIptFocused = true)}
		onblur={() => (tagsIptFocused = false)}
		onpaste={(e) => {
			let pastedText = e.clipboardData?.getData('text') || '';
			let pastedTags = pastedText.split(/\r?\n/);
			if (pastedTags.length > 1) {
				addedTags = addedTags.concat(pastedTags.filter((t) => !!t && !addedTags.includes(t)));
			}
		}}
		oninput={() => {
			tagIndex = 0;
			tagSuggestionsRefs[0]?.focus();
			tagsIpt.focus();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				if (suggestingTags) {
					suggestingTags = false;
				} else tagsIpt.blur();
			}
			if (e.key === 'Enter') {
				if (xFocused) unsaveTagInPersona(suggestedTags[tagIndex]);
				else e.metaKey ? submit() : addTag();
			}
			if (suggestingTags) {
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
	<div class="relative mt-0.5 h-28">
		<div
			class={`bg-bg2 flex flex-col overflow-scroll rounded absolute w-full backdrop-blur-md max-h-full shadow ${
				suggestingTags ? '' : 'hidden'
			}`}
			onmousedown={(e) => e.preventDefault()}
		>
			{#each suggestedTags as tag, i}
				<div class={`group/tag fx hover:bg-bg5 ${tagIndex === i ? 'bg-bg5' : ''}`}>
					<button
						bind:this={tagSuggestionsRefs[i]}
						class={`relative h-8 rounded truncate flex-1 text-left px-2 text-nowrap text-lg`}
						onclick={() => addTag(tag)}
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
		<textarea
			bind:this={bodyTa}
			bind:value={bodyVal}
			placeholder={m.shareThought()}
			class="bg-bg4 rounded h-full resize-none block w-full px-2 py-0.5 text-lg pr-12"
			onkeydown={(e) => {
				e.key === 'Escape' && bodyTa.blur();
				e.metaKey && e.key === 'Enter' && submit();
			}}
		></textarea>
		{#if bodyVal}
			<button class="xy bg-hl1 h-8 w-8 absolute bottom-2 right-2 rounded-full" onclick={submit}>
				<IconArrowUp class="text-bg1 h-8 w-8" />
			</button>
		{/if}
	</div>
</div>
