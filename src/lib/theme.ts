import { gs } from './global-state.svelte';

export let getSystemTheme = () =>
	window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export let setTheme = (theme: 'light' | 'dark' | 'system') => {
	gs.theme = theme;
	localStorage.setItem('theme', theme);
	let dark = (theme === 'system' ? getSystemTheme() : theme) === 'dark';
	document.documentElement.classList[dark ? 'add' : 'remove']('dark');
};
