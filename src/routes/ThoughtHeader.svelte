<script lang="ts">
	import { dev } from '$app/environment';
	import { gs } from '$lib/globalState.svelte';
	import { copyToClipboard } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { deleteThought, getThoughtId, type ThoughtSelect } from '$lib/thoughts';
	import { formatMs, minute } from '$lib/time';
	import {
		IconCopy,
		IconCornerDownRight,
		IconCube,
		IconCube3dSphere,
		IconDots,
		IconFingerprint,
		IconPencil,
		IconTrash,
		IconX,
	} from '@tabler/icons-svelte';

	let xBtn = $state<HTMLButtonElement>();
	let trashBtn = $state<HTMLButtonElement>();
	let pencilBtn = $state<HTMLButtonElement>();

	let p: {
		parsed: boolean;
		onShowMoreBlur: () => void;
		onEdit: () => void;
		onToggleParsed: () => void;
		onLink: () => void;
		thought: ThoughtSelect;
	} = $props();
	let id = $derived(getThoughtId(p.thought));
	let when = $derived(formatMs(p.thought.ms || 0));
	let moreOptionsOpen = $state(false);
</script>

<div class="sticky top-0 bg-inherit">
	<div class="mr-1 gap-2 fx h-5 text-fg2 max-w-full">
		<a
			target="_blank"
			href={`/?q=${id}`}
			class={`${
				when.length > 9 ? 'truncate' : ''
			} text-sm font-bold transition text-fg2 hover:text-fg1 h-6 xy`}
		>
			{when}
		</a>
		<button class="h-6 hover:text-fg1 transition" onclick={() => copyToClipboard(id)}>
			<IconFingerprint class="h-4 w-4" />
		</button>
		<button
			class="h-6 hover:text-fg1 transition"
			onclick={() => copyToClipboard(p.thought.body || '')}
		>
			<IconCopy class="h-4 w-4" />
		</button>
		<button class="h-6 hover:text-fg1 transition" onclick={p.onToggleParsed}>
			{#if p.parsed}
				<IconCube class="h-4 w-4" />
			{:else}
				<IconCube3dSphere class="h-4 w-4" />
			{/if}
		</button>
		<div class="flex-1 h-4 fx">
			<button class="flex-1 min-w-4 h-7 fx hover:text-fg1 transition" onclick={() => p.onLink}>
				<IconCornerDownRight class="absolute w-5" />
			</button>
			{#if moreOptionsOpen}
				<div class="fx gap-2">
					<button
						bind:this={xBtn}
						class="h-4 w-4 xy hover:text-fg1 transition"
						onclick={() => (moreOptionsOpen = false)}
						onkeydown={(e) => e.key === 'Escape' && (moreOptionsOpen = false)}
						onblur={p.onShowMoreBlur}
					>
						<IconX class="absolute h-5 w-5" />
					</button>
					<button
						bind:this={trashBtn}
						class="h-4 w-4 xy hover:text-fg1 transition"
						onclick={async () => {
							const ok =
								dev ||
								Date.now() - (p.thought.ms || 0) < minute ||
								confirm(m.areYouSureYouWantToDeleteThisThought());
							if (!ok) return;
							// TODO: soft deletes
							await deleteThought({ id });
							gs.thoughts[id] = null;
							// const newRoots = clone(roots);
							// let pointer = newRoots;
							// for (let i = 0; i < rootsIndices.length - 1; i++) {
							// 	pointer = pointer[rootsIndices[i]]!.children!;
							// }
							// const deletedThought = pointer[rootsIndices.slice(-1)[0]]!;
							// sendMessage<{ softDelete?: true }>({
							// 	from: personas[0]!.id,
							// 	to: buildUrl({ host: useActiveSpace().host, path: 'delete-thought' }),
							// 	thoughtId: thoughtId(),
							// })
							// 	.then(({ softDelete }) => {
							// 		if (softDelete) {
							// 			deletedThought.content = '';
							// 			deletedThought.tags = [];
							// 		} else {
							// 			pointer.splice(rootsIndices.slice(-1)[0], 1);
							// 		}
							// 		onRootsChange(newRoots);
							// 	})
							// 	.catch((err) => alert(err));
						}}
						onkeydown={(e) => e.key === 'Escape' && (moreOptionsOpen = false)}
						onblur={p.onShowMoreBlur}
					>
						<IconTrash class="absolute h-4 w-4" />
					</button>
					<button
						bind:this={pencilBtn}
						class="h-4 w-4 xy hover:text-fg1 transition"
						onclick={p.onEdit}
						onkeydown={(e) => e.key === 'Escape' && (moreOptionsOpen = false)}
						onblur={p.onShowMoreBlur}
					>
						<IconPencil class="absolute h-4 w-4" />
					</button>
				</div>
			{:else}
				<button
					class="h-5 w-5 xy hover:text-fg1 transition"
					onclick={() => {
						moreOptionsOpen = true;
						setTimeout(() => xBtn?.focus(), 0);
					}}
				>
					<IconDots class="absolute w-4" />
				</button>
			{/if}
		</div>
	</div>
	{#if p.thought.tags?.length}
		<div class="flex flex-wrap gap-x-2">
			{#each p.thought.tags as tag}
				<a
					target="_blank"
					href={`/?q=[${encodeURIComponent(tag)}]`}
					class="font-bold leading-5 transition text-fg2 hover:text-fg1"
				>
					{tag}
				</a>
			{/each}
		</div>
	{/if}
</div>
