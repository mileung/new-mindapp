let dev = import.meta.env.VITE_ENV === 'DEV';

chrome.runtime.onMessage.addListener((msg) => {
	if (msg.type === 'save') openPopup(true);
});

addEventListener('keydown', (e) => {
	let openingNewMindapp = e.key === '©'; // alt g
	if (
		(e.key === 'µ' || // alt m
			openingNewMindapp) &&
		!['INPUT', 'TEXTAREA'].includes(document.activeElement!.tagName)
	) {
		openPopup(openingNewMindapp);
	}
});

let openPopup = (openingNewMindapp?: boolean) => {
	let baseUrl = openingNewMindapp
		? dev
			? 'http://localhost:8888'
			: 'https://new.mindapp.cc'
		: dev
			? 'http://localhost:1234'
			: 'https://mindap.cc';
	const selector =
		urlSelectors[location.host + location.pathname]?.() || urlSelectors[location.host]?.();
	const thoughtHeadline = (
		window.getSelection()?.toString() ||
		// TODO: selectionToMarkdown() ||
		selector?.headline ||
		// TODO: pageToMarkdown() ||
		getTitle()
	).trim();

	let json = JSON.stringify(
		openingNewMindapp
			? {
					body: `${thoughtHeadline}\n${selector?.url || location.href}\n\n`,
					tags: selector?.tags,
				}
			: {
					json: JSON.stringify({
						// https://news.ycombinator.com/item?id=31871577
						// 431 Request Header Fields Too Large
						// https://vitejs.dev/guide/troubleshooting.html#_431-request-header-fields-too-large
						// TODO: thoughtHeadline.slice(0, 99999) or something to avoid 431
						initialContent: `${thoughtHeadline}\n${selector?.url || location.href}\n\n`,
						initialTags: selector?.tags,
					}),
				},
	);

	window.open(
		openingNewMindapp //
			? baseUrl
			: `${baseUrl}?${new URLSearchParams(JSON.parse(json)).toString()}`,
		'_blank',
		`width=700,height=500,top=0,left=99999999`,
	);
};

const urlSelectors: Record<
	string,
	undefined | (() => { headline?: string; url?: string; tags?: string[] })
> = {
	'news.ycombinator.com': () => {
		return { headline: getTitle().slice(0, -14) };
	},
	'www.perplexity.ai': () => {
		return { headline: document.querySelector('h1')?.innerText };
	},
	'www.reddit.com': () => {
		const subreddit = location.href.match(/\/(r\/[^/]+)/)?.[1];
		return { headline: getTitle(), tags: subreddit ? [subreddit] : [] };
	},
	'www.youtube.com/watch': () => {
		const nameTag = document.querySelector('#top-row yt-formatted-string a');
		const ppHref = decodeURIComponent(
			document.querySelector('#owner > ytd-video-owner-renderer > a')?.getAttribute('href')!,
		);

		const author: string = ppHref?.startsWith('/channel/')
			? // @ts-ignore
				nameTag.innerText
			: `YouTube${ppHref?.slice(1)!}`;

		return {
			headline: getTitle(),
			tags: [author],
			url: location.href.replace('&list=WL', '').replace('app=desktop&', ''),
		};
	},
	'www.youtube.com/playlist': () => {
		const author: string = decodeURIComponent(
			document
				.querySelector('yt-page-header-view-model a[href^="/@"]')
				?.getAttribute('href')
				?.slice(1)!,
		);
		return { headline: getTitle(), tags: [`YouTube${author}`] };
	},
	'www.youtube.com': () => {
		const author = location.pathname.startsWith('/@')
			? location.pathname.slice(1, location.pathname.indexOf('/', 1))
			: null;
		const tags = author ? ['YouTube Channel', `YouTube${author}`] : [];
		return { headline: getTitle(), tags };
	},
	'x.com': () => {
		let author = location.pathname.slice(1);
		const i = author.indexOf('/');
		if (i !== -1) author = author.slice(0, i);
		const tweetId = location.pathname.match(/\/status\/(\d+)/)?.[1];
		// TODO: X has really messy messy HTML on purpose I think to make query selectors break. Make this more robust.
		const tweetBlock = document.querySelector(`a[href="/${author}/status/${tweetId}"]`)
			?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
		const tweetText = tweetBlock?.querySelector<HTMLElement>(
			'[data-testid="tweetText"]',
		)?.innerText;

		return {
			headline: tweetText,
			tags: [`X@${author}`],
		};
	},
	'www.amazon.com': () => {
		const headline = document.querySelector<HTMLElement>('#productTitle')?.innerText;
		const endI = Math.min(
			...[
				//
				location.href.indexOf('?'),
				location.href.indexOf('/ref='),
			].filter((n) => n !== -1),
		);
		const url = location.href.slice(0, endI);
		return { headline, url };
	},
	'www.ebay.com': () => {
		const headline = document.querySelector<HTMLElement>('#mainContent h1 > span')?.innerText;
		const endI = Math.min(
			...[
				//
				location.href.indexOf('?'),
			].filter((n) => n !== -1),
		);
		const url = location.href.slice(0, endI);
		return { headline, url };
	},
};

function getTitle() {
	return document.querySelector('meta[name="title"]')?.getAttribute('content') || document.title;
}

export {};
