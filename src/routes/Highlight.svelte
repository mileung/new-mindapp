<script lang="ts">
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { getSystemTheme } from '$lib/theme';
	import { getIdStr, isIdStr } from '$lib/types/parts/partIds';

	let p: {
		postIdStr?: string;
		class?: string;
		noScrollId?: boolean;
		main?: boolean;
		reply?: boolean;
		evenBg?: boolean;
	} = $props();

	let urlId = $derived.by(() => {
		let pathname = page.url.pathname;
		let s = pathname.slice(1);
		let slashIndex = s.indexOf('/');
		if (slashIndex > 0) s = s.slice(0, slashIndex);
		if (isIdStr(s)) return s;
	});
	let spotId = $derived(urlId?.endsWith('__') ? '' : urlId);
	let moreOpaque = $derived(
		p.evenBg ||
			gs.theme === 'light' || //
			(gs.theme === 'system' && getSystemTheme() === 'light'),
	);

	let [lineColor, overlayColor] = $derived.by(() => {
		if (!p.postIdStr) return ['bg-hl2', moreOpaque ? 'bg-hl2/10' : 'bg-hl2/5'];
		let post = gs.showReactionHistory || gs.postingTo || gs.postingEdit;
		if (post && getIdStr(post) === p.postIdStr) {
			return gs.showReactionHistory
				? ['bg-hl-spot', moreOpaque ? 'bg-hl-spot/10' : 'bg-hl-spot/5']
				: gs.postingTo
					? ['bg-hl-link', moreOpaque ? 'bg-hl-link/10' : 'bg-hl-link/5']
					: gs.postingEdit
						? ['bg-hl-edit', moreOpaque ? 'bg-hl-edit/10' : 'bg-hl-edit/5']
						: [];
		}
		if (spotId === p.postIdStr)
			return ['bg-hl-spot', moreOpaque ? 'bg-hl-spot/10' : 'bg-hl-spot/5'];
		// TODO: match identicon color?
		if (p.reply) return ['bg-fg2', ''];
		return [];
	});
</script>

{#if lineColor}
	<div
		{...!p.noScrollId && p.main ? { id: 'hl-' + p.postIdStr } : {}}
		class={`${p.main ? '' : 'hl-' + p.postIdStr} z-40 absolute pointer-events-none inset-0 ${overlayColor} ${p.class}`}
	>
		<div class="w-0.5 h-full {lineColor}"></div>
	</div>
{/if}
