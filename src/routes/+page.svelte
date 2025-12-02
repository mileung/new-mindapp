<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { scrape } from '$lib/dom';
	import { gs } from '$lib/global-state.svelte';
	import { getLocalCache } from '$lib/types/local-cache';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(`/__${getLocalCache().currentSpaceMs}`, { replaceState: true });
		if (page.url.searchParams.get('extension') !== null) {
			window.postMessage({ type: '2-popup-requests-external-page-info' }, '*');
			window.addEventListener('message', (event) => {
				console.log('event:', event);
				if (event.source !== window) return;
				if (event.data.type === '4-popup-receives-external-page-info') {
					let { url, externalDomString, selectedPlainText, selectedHtmlString } =
						(event.data.payload as {
							url?: string;
							externalDomString?: string;
							selectedPlainText?: string;
							selectedHtmlString?: string;
						}) || {};
					if (!url || !externalDomString) return;
					let scrapedInfo = scrape(url, externalDomString);
					console.log('scrapedInfo:', scrapedInfo);

					gs.writingNew = true;
					gs.writerTags = scrapedInfo.tags || [];
					// TODO: think of a better ux. Like when a user highlights and runs the mindapp shortcut, what should be prepopulated in the writer?
					// TODO: convert selection to md. Include links, images, video, iframes, other stuff if possible
					gs.writerCore = `${scrapedInfo.headline}\n${scrapedInfo.url}\n\n${selectedPlainText}`;
				}
			});
		}
	});
</script>
