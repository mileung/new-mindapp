<script lang="ts">
	import { page } from '$app/state';
	import { isStringifiedRecord, sortUniArr } from '$lib/js';
	import type { ThoughtInsert, ThoughtSelect } from '$lib/thoughts';
	import { matchSorter } from 'match-sorter';

	import { IconArrowUp, IconCircleXFilled } from '@tabler/icons-svelte';

	let bodyTa: HTMLTextAreaElement;
	let tagsIpt: HTMLInputElement;
	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let tagXs = $state<(undefined | HTMLButtonElement)[]>([]);
	let addedTagsContainerDiv: HTMLDivElement;

	let tagsFilter = $state('');
	let tagIndex = $state(-1);
	let suggestingTags = $derived(!!tagsFilter);

	let p: {
		thought?: ThoughtSelect;
		initialTags?: string[];
		initialBody?: string;
		onSubmit: (a: { tags?: string[]; body?: string }) => void;
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

	let submit = () => {
		const addedTag = (suggestingTags && suggestedTags[tagIndex]) || tagsFilter.trim();

		const tags = sortUniArr([...addedTags, ...(addedTag ? [addedTag] : [])]);
		p.onSubmit({
			tags: tags.length ? tags : undefined,
			body: bodyVal.trim() || undefined,
		});

		addedTags = [];
		tagsFilter = '';
		bodyVal = '';
	};

	const addTag = (tagToAdd?: string) => {
		tagToAdd = tagToAdd || suggestedTags[tagIndex] || trimmedFilter;
		if (!tagToAdd) return;
		addedTags = [...new Set([...addedTags, tagToAdd])];
		tagsIpt!.focus();
		tagsFilter = '';
		tagIndex = -1;
	};

	let trimmedFilter = $derived(tagsFilter.trim());
	let allTags = $derived(
		!suggestingTags
			? []
			: [
					'1900s',
					'1910s',
					'1920s',
					'1930s',
					'1940s',
					'1950s',
					'1960s',
					'1970s',
					'1980s',
					'1990s',
					'2000s',
					'2010s',
					'2020s',
					'Music',
					'Conversation',
				],
	);
	let suggestedTags = $derived(
		(() => {
			if (!suggestingTags) return [];
			let addedTagsSet = new Set(addedTags);
			let filter = trimmedFilter.replace(/\s+/g, ' ');
			let arr = matchSorter(allTags, filter).slice(0, 99).concat(trimmedFilter);
			return [...new Set(arr)].filter((tag) => tag && !addedTagsSet.has(tag));
		})(),
	);
</script>

<div class="bg-bg5 w-full rounded">
	<div
		bind:this={addedTagsContainerDiv}
		tabindex="-1"
		class={`mb-0.5 fx flex-wrap text-lg px-3 py-1 gap-1 border-bg1 border-b-1 ${addedTags.length ? '' : 'hidden'}`}
		onclick={() => tagsIpt.focus()}
	>
		{#each addedTags as name, i}
			<div class="text-fg1 flex group">
				{name}
				<button
					class="xy -ml-0.5 group h-7 w-7 rounded-full -outline-offset-4"
					bind:this={tagXs[i]}
					onclick={(e) => {
						e.stopPropagation(); // this is needed to focus the next tag
						addedTags = addedTags.filter((_, index) => index !== i);
						if (!addedTags.length || (i === addedTags.length && !e.shiftKey)) {
							tagsIpt?.focus();
						}
					}}
					onkeydown={(e) => {
						if (e.key === 'Backspace') {
							addedTags = addedTags.filter((_, index) => index !== i);
						} else if (!['Control', 'Alt', 'Tab', 'Shift', 'Meta', 'Enter'].includes(e.key)) {
							tagsIpt?.focus();
						}
					}}
					onmouseup={() => {
						setTimeout(() => tagsIpt?.focus(), 0);
					}}
				>
					<IconCircleXFilled class="w-4 h-4 text-fg2 group-hover:text-fg1 transition" />
				</button>
			</div>
		{/each}
	</div>
	<input
		bind:this={tagsIpt}
		bind:value={tagsFilter}
		autocomplete="off"
		class="w-full px-3 py-1 text-xl border-bg1 border-b-1 focus:outline-none"
		placeholder="Search Tags"
		onclick={() => (suggestingTags = true)}
		onfocus={() => (suggestingTags = true)}
		oninput={(e) => {
			tagSuggestionsRefs[0]?.focus();
			tagsIpt?.focus();
			tagIndex = e.currentTarget.value.length ? 0 : -1;
			suggestingTags = true;
			tagsFilter = e.currentTarget.value;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.metaKey ? submit() : addTag();
			}
			e.key === 'Tab' && (suggestingTags = false);
			if (e.key === 'Escape') {
				suggestingTags = false;
				bodyTa.focus();
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				let index = Math.max(tagIndex - 1, -1);
				tagSuggestionsRefs[index]?.focus();
				tagsIpt?.focus();
				tagIndex = index;
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				let index = Math.min(tagIndex + 1, suggestedTags!.length - 1);
				tagSuggestionsRefs[index]?.focus();
				tagsIpt?.focus();
				tagIndex = index;
			}
		}}
		onblur={() => {
			setTimeout(() => {
				if (
					document.activeElement !== addedTagsContainerDiv &&
					document.activeElement !== tagsIpt &&
					!tagXs.find((e) => e === document.activeElement) &&
					!tagSuggestionsRefs.find((e) => e === document.activeElement)
				) {
					tagIndex = -1;
					suggestingTags = false;
				}
			}, 0);
		}}
	/>
	<div class="relative h-28">
		<div
			class={`z-50 flex flex-col overflow-scroll rounded-b absolute w-full backdrop-blur-xs max-h-full shadow ${
				tagsFilter ? '' : 'hidden'
			}`}
		>
			{#if suggestedTags.length}
				{#each suggestedTags as tag, i}
					<button
						bind:this={tagSuggestionsRefs[i]}
						class={`fx px-3 text-nowrap text-xl hover:bg-bg4 ${tagIndex === i ? 'hover:bg-bg8 bg-bg8' : ''}`}
						onclick={() => addTag(tag)}
					>
						{tag}
					</button>
				{/each}
			{/if}
		</div>
		<textarea
			bind:this={bodyTa}
			bind:value={bodyVal}
			placeholder="Share thought"
			class="border-fg3 h-full resize-none block w-full px-3 py-1 text-xl pr-12 focus:outline-none"
			onkeydown={(e) => e.metaKey && e.key === 'Enter' && submit()}
		></textarea>
		{#if bodyVal}
			<button class="xy bg-hl1 h-8 w-8 absolute bottom-2 right-2 rounded-full" onclick={submit}>
				<IconArrowUp class="text-bg1 h-8 w-8" />
			</button>
		{/if}
	</div>
</div>
