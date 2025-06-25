import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [],
	build: {
		outDir: 'dist',
		rollupOptions: {
			input: {
				content: 'src/content.ts',
				background: 'src/background.ts',
			},
			output: {
				entryFileNames: '[name].js',
			},
		},
	},
});
