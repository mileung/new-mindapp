<script lang="ts">
	import { page } from '$app/state';
	import { identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { spaceMsToName } from '$lib/types/spaces';
	import { IconDeviceFloppy, IconEdit, IconLockFilled, IconX } from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let p: {
		ms: number;
		isAccount?: boolean;
		name?: string;
		bio?: string;
		description?: string;
		visibilityPublic?: boolean;
		newUsersCanReact?: boolean;
		newUsersCanPost?: boolean;
		onChange: (changes: {
			name?: string;
			bio?: string;
			description?: string;
			visibilityPublic?: boolean;
			newUsersCanReact?: boolean;
			newUsersCanPost?: boolean;
		}) => void;
	} = $props();

	let editing = $state(false);
	let visibilityPublic = $state(1);
	let newUsersCanReact = $state(1);
	let newUsersCanPost = $state(1);

	let slug = $derived(p.isAccount ? `_${p.ms}_` : `__${p.ms}`);
</script>

<div class="w-full max-w-lg">
	<div class="flex justify-between h-10">
		{#if p.isAccount}
			<AccountIcon class="h-10 w-10" ms={p.ms} />
		{:else}
			<SpaceIcon class="h-10 w-10" ms={p.ms} />
		{/if}
		{#if editing}
			<div class="flex h-8">
				<button
					class="w-8 xy hover:bg-bg3 text-fg2 hover:text-fg1"
					onclick={() => {
						editing = false;
					}}
				>
					<IconX class="w-5" />
				</button>
				<button
					class="xy pl-0.5 pr-1 border-b-2 border-hl1 hover:border-hl2 bg-bg2 hover:bg-bg4 hover:text-fg3"
					onclick={() => {
						editing = false;
					}}
				>
					<IconDeviceFloppy class="w-5 mr-1" />
					{m.save()}
				</button>
			</div>
		{:else}
			<button
				class="h-8 xy pl-0.5 pr-1 hover:bg-bg4 text-fg2 hover:text-fg1"
				onclick={() => (editing = true)}
			>
				<IconEdit class="w-5 mr-1" />
				{m.edit()}
			</button>
		{/if}
	</div>
	{#if editing}
		<p class="font-bold">{m.name()}</p>
		<input class="w-full px-2 border-l-2 border-bg8 text-lg bg-bg2 hover:bg-bg4" />
		<p class="mt-1 font-bold">{p.isAccount ? m.bio() : m.description()}</p>
		<textarea
			class="resize-y w-full px-2 py-0.5 border-l-2 border-bg8 text-lg bg-bg2 hover:bg-bg4 block"
		></textarea>
		{#if !p.isAccount}
			<div class="mt-2 flex">
				<div class="flex-1">
					<p class="text-sm font-bold">{m.visibility()}</p>
					<select
						name={m.visibility()}
						class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-2 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
						bind:value={visibilityPublic}
					>
						<option value={0}>{m.private()}</option>
						<option value={1}>{m.public()}</option>
					</select>
				</div>
				<div class="flex-2">
					<p class="text-sm font-bold">{m.newMembers()}</p>
					<div class="flex">
						<select
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-2 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
							bind:value={newUsersCanPost}
						>
							<option value={0}>{m.cannotReact()}</option>
							<option value={1}>{m.canReact()}</option>
						</select>
						<select
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-2 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
							bind:value={newUsersCanPost}
						>
							<option value={0}>{m.cannotPost()}</option>
							<option value={1}>{m.canPost()}</option>
						</select>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="flex">
			<p class="text-xl font-bold">
				{spaceMsToName(p.ms)}
			</p>
			{#if !p.isAccount}
				<IconLockFilled class="self-center h-5 mb-0.5" />
			{/if}
			<p class="self-end ml-1 text-fg2">{identikana(p.ms)}</p>
		</div>
		<div class="overflow-scroll gap-2 fx justify-between text-nowrap text-fg2">
			<a class="hover:text-fg1 hover:underline hover:bg-bg3" href={`${page.url.origin}/${slug}`}>
				{slug}
			</a>
			<p class="">{m.createdD({ d: formatMs(p.ms, 'day') })}</p>
		</div>
		<p class="">bio</p>
	{/if}
</div>
