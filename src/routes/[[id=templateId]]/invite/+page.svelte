<script lang="ts">
	import { page } from '$app/state';
	import { spaceMsToSpaceName } from '$lib/global-state.svelte';
	import { identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { idStrAsIdObj } from '$lib/types/parts/partIds';
	import { IconLinkPlus } from '@tabler/icons-svelte';
	import { type InfiniteEvent } from 'svelte-infinite-loading';
	import AccountIcon from '../../AccountIcon.svelte';

	let paramIdObj = $derived(idStrAsIdObj(page.params.id || ''));
	let created = $derived(formatMs(paramIdObj.in_ms!));

	let searchIpt: HTMLInputElement;
	let searchVal = $state('');
	let accountMss = $state<number[]>([]);

	let loadMoreAccounts = async (e: InfiniteEvent) => {
		// await new Promise((res) => setTimeout(res, 1000));
		// console.log(
		// 	'loadMoreAccounts:',
		// 	identifier,
		// 	// $state.snapshot(gs.feeds[identifier]),
		// 	// $state.snapshot(gs.posts),
		// );

		// if (!gs.accounts || !identifier || !p.idParam || personalSpaceRequiresLogin) return;

		// let fromMs = gs.feeds[identifier]?.slice(-1)[0];
		// if (fromMs === null) return e.detail.complete();
		// fromMs = typeof fromMs === 'number' ? fromMs : oldestFirst ? 0 : Number.MAX_SAFE_INTEGER;

		// let accounts: Awaited<ReturnType<typeof getPostFeed>>;
		accountMss = [
			//
			// ...Array(19),
		].map(() => +('' + Math.random()).slice(2));
		let newFromMs = 0; //lastRoot?.ms;
		let endReached = true; //rootPosts.length < postsPerLoad;
		e.detail.loaded();
		endReached ? e.detail.complete() : e.detail.loaded();
	};

	let expireAfter = $state('');
	let maxUses = $state('');
</script>

<div class="xy min-h-screen p-5">
	<div class="w-full max-w-sm">
		<div class="text-xl font-bold">
			<p class="text-3xl font-black">
				{spaceMsToSpaceName(0)}
			</p>
			<p class="mt-2">{m.expires()}</p>
			<select
				name={m.expires()}
				class="font-normal text-lg mt-1 w-full p-2 bg-bg5 hover:bg-bg7 text-fg1"
				bind:value={expireAfter}
			>
				<option value="">{m.never()}</option>
			</select>
			<p class="mt-2">{m.maxUses()}</p>
			<select
				name={m.maxUses()}
				class="font-normal text-lg mt-1 w-full p-2 bg-bg5 hover:bg-bg7 text-fg1"
				bind:value={maxUses}
			>
				<option value="">{m.unlimited()}</option>
			</select>
			<button class="mt-2 xy font-semibold text-black p-1 px-2 gap-1 bg-hl1 hover:bg-hl2">
				<IconLinkPlus />
				{m.createInviteLink()}
			</button>
			{#each accountMss || [] as ms}
				<div class="fx h-8 gap-2 mt-2">
					<AccountIcon {ms} class="h-full w-8" />
					<p class="font-medium text-lg italic">
						{identikana(ms)}
						<span class="text-sm text-fg2 font-normal">{ms}</span>
					</p>
				</div>
			{/each}
		</div>
	</div>
</div>
