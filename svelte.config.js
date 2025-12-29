import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// checkOrigin true by default to csrf attacks
		// https://svelte.dev/docs/kit/configuration#csrf
		// https://gist.github.com/Maxiviper117/95a31750b74510bbb413d2e4ae20b4e8
		// TODO: api for Mindapp to let other apps use Mindapp as a sort of human readable DB
	},
	// https://github.com/sveltejs/language-tools/issues/650#issuecomment-2260462839
	compilerOptions: {
		// disable all warnings coming from node_modules and all accessibility warnings
		warningFilter: (warning) =>
			!warning.filename?.includes('node_modules') && !warning.code.startsWith('a11y'),
	},
};

export default config;
