import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage } from 'http';
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

let requestEnablesSqlocal = (request: IncomingMessage) =>
	(request.headers.cookie ?? '')
		.split(';') //
		.some((c) => c.trim() === 'sqlocalOk=1');

export default defineConfig({
	optimizeDeps: {
		exclude: ['sqlocal'],
	},
	worker: {
		format: 'es',
	},
	server: {
		port: 8888,
		headers: {
			// 'Cross-Origin-Embedder-Policy': 'require-corp',
			// 'Cross-Origin-Opener-Policy': 'same-origin',
		},
	},
	preview: {
		port: 1111,
		headers: {
			// 'Cross-Origin-Embedder-Policy': 'require-corp',
			// 'Cross-Origin-Opener-Policy': 'same-origin',
		},
	},
	plugins: [
		{
			name: 'configure-response-headers',
			configureServer: (server) => {
				server.middlewares.use((req, res, next) => {
					if (requestEnablesSqlocal(req)) {
						res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
						res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
					}
					next();
				});
			},
		},
		{
			name: 'configure-preview,response-headers',
			configurePreviewServer: (server) => {
				server.middlewares.use((req, res, next) => {
					if (requestEnablesSqlocal(req)) {
						res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
						res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
					}
					next();
				});
			},
		},
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['url', 'cookie', 'baseLocale'],
		}),
	],
});
