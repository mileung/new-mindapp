<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getPromptSigningIn, gs, msToSpaceNameTxt } from '$lib/global-state.svelte';
	import { getAlteredSearchParams } from '$lib/js';
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
		if (!page.url.searchParams.has('inMss')) {
			goto(
				getAlteredSearchParams({
					inMss: cloudSpaceMss.join(','),
				}),
				{ replaceState: true },
			);
		}
	});

	let mergedMssSet = $derived(
		new Set(
			page.url.searchParams
				.get('inMss')
				?.split(',') //
				.map(Number) || [],
		),
	);

	let makeParams = (toggleSpaceMs: number) => {
		let inMss = cloudSpaceMss
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
		return getAlteredSearchParams({ inMss });
	};
</script>

{#if callerMs === undefined}
	<!--  -->
{:else if promptSignIn}
	<PromptSignIn />
{:else}
	<div class="w-full bg-bg1 fixed top-0 flex flex-wrap text-fg2">
		{#each cloudSpaceMss as cloudSpaceMs (cloudSpaceMs)}
			<a
				href={makeParams(cloudSpaceMs)}
				class={`h-8 group fx pr-1.5 text-nowrap hover:bg-bg4 hover:text-fg1 ${mergedMssSet.has(cloudSpaceMs) ? 'text-fg1' : ''}`}
			>
				<SpaceIcon
					ms={cloudSpaceMs}
					class={`h-4 w-5 ${mergedMssSet.has(cloudSpaceMs) ? '' : 'grayscale-100 group-hover:grayscale-75'}`}
				/>{msToSpaceNameTxt(cloudSpaceMs)}
			</a>
		{/each}
	</div>
	<PostFeed />
{/if}
