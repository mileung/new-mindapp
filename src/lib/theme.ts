import { setCookie } from './cookies';
import { gs } from './globalState.svelte';

export let getSystemTheme = () =>
	window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export let setTheme = (theme: 'light' | 'dark') => {
	gs.theme = theme;
	setCookie('theme', theme);
	document.documentElement.classList[theme.includes('dark') ? 'add' : 'remove']('dark');
};
