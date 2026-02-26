<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { scrollToHighlight } from '$lib/dom';
	import { isIdStr } from '$lib/types/parts/partIds';
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	let p: HTMLAnchorAttributes & { noPush?: boolean; children: Snippet } = $props();

	let handleClick = (e: MouseEvent) => {
		return;
		if (!p.noPush && p.href && !e.metaKey && !e.shiftKey && !e.ctrlKey) {
			e.preventDefault();
			// https://svelte.dev/docs/kit/shallow-routing

			let { pathname, search } = new URL(p.href, page.url.origin);
			let idStr = pathname.slice(1);
			isIdStr(idStr) && pathname === page.state.modal?.pathname
				? scrollToHighlight(idStr)
				: pushState(p.href, {
						modal: { pathname, search },
						lastScrollY: window.scrollY,
					});
		}
	};
</script>

<a {...p} onclick={handleClick}>
	{@render p.children()}
</a>
