<script lang="ts">
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { getSystemTheme } from '$lib/theme';
	import { getIdStr } from '$lib/types/parts/partIds';

	let p: {
		postId?: string;
		class?: string;
		noScrollTo?: boolean;
		main?: boolean;
		reply?: boolean;
		evenBg?: boolean;
	} = $props();

	let urlId = $derived(page.state.modalId || page.params.id);
	let spotId = $derived(urlId && urlId[0] !== 'l' ? urlId : '');
	let moreOpaque = $derived(
		p.evenBg ||
			gs.theme === 'light' || //
			(gs.theme === 'system' && getSystemTheme() === 'light'),
	);

	let [lineColor, overlayColor] = $derived.by(() => {
		if (!p.postId) return ['bg-hl2', moreOpaque ? 'bg-hl2/10' : 'bg-hl2/5'];
		let post = gs.showReactionHistory || gs.writingTo || gs.writingEdit;
		if (post && getIdStr(post) === p.postId) {
			return gs.showReactionHistory
				? ['bg-hl-spot', moreOpaque ? 'bg-hl-spot/10' : 'bg-hl-spot/5']
				: gs.writingTo
					? ['bg-hl-link', moreOpaque ? 'bg-hl-link/10' : 'bg-hl-link/5']
					: gs.writingEdit
						? ['bg-hl-edit', moreOpaque ? 'bg-hl-edit/10' : 'bg-hl-edit/5']
						: [];
		}
		if (spotId === p.postId) return ['bg-hl-spot', moreOpaque ? 'bg-hl-spot/10' : 'bg-hl-spot/5'];
		// TODO: match identicon color
		if (p.reply) return ['bg-fg1', moreOpaque ? 'bg-fg1/10' : 'bg-fg1/5'];
		return [];
	});
</script>

{#if lineColor && overlayColor}
	<div
		{...p.noScrollTo
			? {} //
			: p.main
				? {}
				: { id: 'post-' + p.postId }}
		class={`${p.main ? 'post-' + p.postId : ''} z-40 absolute pointer-events-none inset-0 ${overlayColor} ${p.class}`}
	>
		<div class="w-0.5 h-full {lineColor}"></div>
	</div>
{/if}
