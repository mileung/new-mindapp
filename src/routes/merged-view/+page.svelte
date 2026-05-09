<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getPromptSigningIn, gs, msToSpaceNameTxt } from '$lib/global-state.svelte';
	import { setSearchParams } from '$lib/js';
	import PostFeed from '../PostFeed.svelte';
	import PromptSignIn from '../PromptSignIn.svelte';
	import SpaceIcon from '../SpaceIcon.svelte';

	let callerMs = $derived(gs.accounts?.[0].ms);
	let promptSignIn = $derived(getPromptSigningIn());

	let cloudSpaceMss = $derived<number[]>([
		gs.accounts?.[0].ms || 8,
		1,
		...(gs.accounts?.[0].joinedSpaceContexts || []).map((s) => s.ms).filter((ms) => ms !== 1),
	]);

	$effect(() => {
		if (!page.url.searchParams.has('in_ms')) {
			goto(`?in_ms=${cloudSpaceMss.join(',')}`);
		}
	});

	let mergedMssSet = $derived(
		new Set(
			page.url.searchParams
				.get('in_ms')
				?.split(',') //
				.map(Number) || [],
		),
	);

	let makeParams = (toggleSpaceMs: number) => {
		let in_ms = cloudSpaceMss
			.map((ms) =>
				ms === toggleSpaceMs
					? mergedMssSet.has(toggleSpaceMs)
						? -1
						: ms
					: mergedMssSet.has(ms)
						? ms
						: -1,
			)
			.filter((ms) => ms >= 0)
			.join(',');
		return setSearchParams({ in_ms });
	};
</script>

{#if callerMs === undefined}
	<!--  -->
{:else if promptSignIn}
	<PromptSignIn />
{:else}
	<div class="flex flex-wrap text-fg2">
		{#each cloudSpaceMss as cloudSpaceMs (cloudSpaceMs)}
			<a
				href={makeParams(cloudSpaceMs)}
				class={`h-8 group fx pr-1.5 text-nowrap hover:bg-bg4 hover:text-fg1 ${mergedMssSet.has(cloudSpaceMs) ? 'text-fg1' : ''}`}
			>
				<SpaceIcon
					ms={cloudSpaceMs}
					class={`h-4 w-5 ${mergedMssSet.has(cloudSpaceMs) ? '' : 'grayscale-100 group-hover:grayscale-50'}`}
				/>{msToSpaceNameTxt(cloudSpaceMs)}
			</a>
		{/each}
	</div>
	<PostFeed />
{/if}
