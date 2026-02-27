import { dev } from '$app/environment';
import { m } from './paraglide/messages';

export let textInputFocused = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement!.tagName);

export let getPostWriterHeight = () =>
	parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--h-post-writer'));

export let scrollToHighlight = (id: string) => {
	let hlc =
		document.querySelector('.hlc-' + id) || //
		document.querySelector('.flat-at-hlc-' + id) ||
		document.querySelector('.cited-hlc-' + id);
	let hl =
		document.querySelector('#hl-' + id) || //
		document.querySelector('.hl-' + id);
	if (hlc && hl) {
		let { top: hlcTop } = hlc.getBoundingClientRect();
		let { height: hlHeight } = hl.getBoundingClientRect();
		window.scrollTo({
			top:
				window.scrollY -
				(window.innerHeight - hlcTop) +
				hlHeight + //
				getPostWriterHeight(),
			behavior: 'smooth',
		});
	}
};

export let scrape = (externalUrl: string, externalDomString: string) => {
	let externalDom = new DOMParser().parseFromString(externalDomString, 'text/html');

	let urlScrapers: Record<
		string,
		undefined | (() => { headline?: string; tags?: string[]; url?: string })
	> = {
		// TODO: IMDB for Movie genres https://www.imdb.com/title/tt1877832/
		'www.perplexity.ai': () => {
			return { headline: externalDom.querySelector('h1')?.innerText };
		},
		'www.reddit.com': () => {
			let subreddit = externalUrl.match(/\/(r\/[^/]+)/)?.[1];
			// TODO: get the post core as markdown
			// e.g. https://www.reddit.com/r/UI_Design/comments/vzqe34/menu_knowledge_is_essential/
			return { tags: subreddit ? [subreddit] : [] };
		},
		'www.youtube.com/watch': () => {
			// @ts-ignore
			let title: string = externalDom.querySelector('h1.style-scope.ytd-watch-metadata')?.innerText;
			let nameTag = externalDom.querySelector('#top-row yt-formatted-string a');
			let ppHref = decodeURIComponent(
				externalDom.querySelector('#owner > ytd-video-owner-renderer > a')?.getAttribute('href')!,
			);

			let author: string = ppHref?.startsWith('/channel/')
				? // @ts-ignore
					nameTag.innerText
				: `YouTube${ppHref?.slice(1)!}`;

			let url = externalUrl.replace('app=desktop&', '');
			if (url.includes('list=WL')) {
				url = url.replace('&list=WL', '');
				url = url.replace(/&index=\d+/, '');
			}
			return {
				headline: title,
				tags: [author],
				url,
			};
		},
		'www.youtube.com/playlist': () => {
			let author: string = decodeURIComponent(
				document
					.querySelector('yt-page-header-view-model a[href^="/@"]')
					?.getAttribute('href')
					?.slice(1)!,
			);

			return {
				headline: externalDom.querySelector<HTMLHeadElement>(
					'h1 .yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap',
				)?.innerText,
				tags: [`YouTube${author}`],
			};
		},
		'www.youtube.com': () => {
			let author = location.pathname.startsWith('/@')
				? location.pathname.slice(1, location.pathname.indexOf('/', 1))
				: null;
			let tags = author ? ['YouTube Channel', `YouTube${author}`] : [];
			return {
				headline: externalDom.querySelector<HTMLHeadElement>('h1.dynamic-text-view-model-wiz__h1')
					?.innerText,
				tags,
			};
		},
		'x.com': () => {
			let author = location.pathname.slice(1);
			let i = author.indexOf('/');
			if (i !== -1) author = author.slice(0, i);
			let tweetId = location.pathname.match(/\/status\/(\d+)/)?.[1];
			// TODO: X has really messy messy HTML on purpose I think to make query selectors break. Make this more robust.
			let tweetBlock = externalDom.querySelector(`a[href="/${author}/status/${tweetId}"]`)
				?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
			let tweetText = tweetBlock?.querySelector<HTMLElement>(
				'[data-testid="tweetText"]',
			)?.innerText;

			return {
				headline: tweetText,
				tags: [`X@${author}`],
			};
		},
		'www.amazon.com': () => {
			let headline = externalDom.querySelector<HTMLElement>('#productTitle')?.innerText;
			let endI = Math.min(
				...[
					//
					externalUrl.indexOf('?'),
					externalUrl.indexOf('/ref='),
				].filter((n) => n !== -1),
			);
			let url = externalUrl.slice(0, endI);
			return { headline, url };
		},
		// TODO: make a better url matcher. Saving search results doesn't save title as expected, only when you're on a item page
		'www.ebay.com': () => {
			let headline = externalDom.querySelector<HTMLElement>('#mainContent h1 > span')?.innerText;
			let endI = Math.min(
				...[
					//
					externalUrl.indexOf('?'),
				].filter((n) => n !== -1),
			);
			let url = externalUrl.slice(0, endI);
			return { headline, url };
		},
	};

	let urlObj = new URL(externalUrl);
	let scraped = (urlScrapers[urlObj.host + urlObj.pathname] || urlScrapers[urlObj.host])?.();

	return {
		tags: scraped?.tags || [],
		// getSelectionAsMarkdown() ||
		headline: (
			scraped?.headline ||
			externalDom.querySelector('meta[name="title"]')?.getAttribute('content') ||
			externalDom.title ||
			decodeURIComponent(externalUrl.slice(externalUrl.lastIndexOf('/') + 1))
		).trim(),
		url: scraped?.url || externalUrl,
	};
};

export let getHoverColors = () => {
	// TODO: for borders, bgs, etc
	// Difference in hover and default state should be 2 or 3 levels idk yet
};

export let promptSum = (cb: (a: number, b: number) => string) => {
	let requireSumPrompt = !dev;
	if (requireSumPrompt) {
		let a = Math.floor(Math.random() * 90) + 10;
		let b = Math.floor(Math.random() * 90) + 10;
		let sum = prompt(cb(a, b));
		if (!sum) return;
		if (a + b !== +sum) return alert(m.incorrect());
	}
	return true;
};
