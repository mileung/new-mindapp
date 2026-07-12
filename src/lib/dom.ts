import { dev } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { m } from './paraglide/messages';

export let setGlobalCssVariable = (name: string, val: string) =>
	document.documentElement.style.setProperty(name, val);

export let textInputFocused = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement!.tagName);

export let getPostWriterHeight = () =>
	parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--h-post-writer'));

export let gotoIfNeeded = (target: string) => {
	let currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
	let urlObj = new URL(target, window.location.origin);
	let nextUrl = `${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
	if (currentUrl !== nextUrl) goto(target);
};

export let scrollToHighlight = (id: string, goToIdIfHlDne = false) => {
	let hl =
		document.querySelector('#hl-' + id) || //
		document.querySelector('.hl-' + id);
	if (hl) {
		let hlRect = hl.getBoundingClientRect();
		let headerHeight =
			page.url.pathname === '/merged-view' || page.url.pathname === '/owner-view' ? 64 : 32;

		let top =
			window.scrollY -
			window.innerHeight +
			hlRect.top + //
			hlRect.height +
			getPostWriterHeight();

		let scrollAmount = top - window.scrollY;
		let hlTopAfterScroll = hlRect.top - scrollAmount;
		if (hlTopAfterScroll < headerHeight) {
			top -= headerHeight - hlTopAfterScroll;
		}

		window.scrollTo({
			top,
			behavior: 'smooth',
		});
	} else if (goToIdIfHlDne) {
		gotoIfNeeded(`/${id}`);
	} else console.warn('no id to scroll to');
};

let ytRegex =
	/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
export let getYtVideoId = (url: string) => url.match(ytRegex)?.[1];

export let promptSum = (cb: (a: number, b: number) => string) => {
	let requireSumPrompt = !dev;
	// requireSumPrompt = true;
	if (requireSumPrompt) {
		let a = Math.floor(Math.random() * 90) + 10;
		let b = Math.floor(Math.random() * 90) + 10;
		let sum = prompt(cb(a, b));
		if (!sum) return false;
		if (a + b !== +sum) return alert(m.incorrect()), false;
	}
	return true;
};
