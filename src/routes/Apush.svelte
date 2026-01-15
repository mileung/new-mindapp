<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { isTemplateId } from '$lib/types/parts/partIds';
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	let p: HTMLAnchorAttributes & { children: Snippet } = $props();

	let handleClick = (e: MouseEvent) => {
		if (p.href && !e.metaKey && !e.shiftKey && !e.ctrlKey) {
			e.preventDefault();
			// https://svelte.dev/docs/kit/shallow-routing

			let urlObj = new URL(p.href, page.url);
			let idStr: null | string = urlObj.pathname.slice(1);
			// console.log('idStr:', idStr);
			// console.log('urlObj.search:', urlObj.search);
			if (isTemplateId(idStr)) {
				if (urlObj.search) {
					// TODO:
				} else {
					pushState(p.href, { postIdStr: idStr, lastScrollY: window.scrollY });
				}
				console.log(urlObj);
			} else throw new Error(`Apush href must have an id param`);
		}
	};
</script>

<a {...p} onclick={handleClick}>
	{@render p.children()}
</a>
