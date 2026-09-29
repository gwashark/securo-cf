import tailwindcss from '@tailwindcss/vite'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import path from 'node:path'
import { defineConfig } from 'astro/config'
import { loadEnv } from 'vite'

function getFrontendHost(frontendUrl) {
	if (!frontendUrl) return []

	const withoutProtocol = frontendUrl.replace(/^https?:\/\//, '')
	return [withoutProtocol.split(/[:/]/)[0]]
}

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
const frontendUrl = env.FRONTEND_URL || process.env.FRONTEND_URL
const appVersion = env.VITE_APP_VERSION || process.env.VITE_APP_VERSION || '0.0.1'

export default defineConfig({
	adapter: cloudflare(),
	output: 'server',
	integrations: [react()],
	devToolbar: {
		enabled: false,
	},
	vite: {
		define: {
			__APP_VERSION__: JSON.stringify(appVersion),
		},
		plugins: [tailwindcss()],
		resolve: {
			alias: [
				{
					find: /^@\//,
					replacement: `${path.resolve(process.cwd(), './src/app')}/`,
				},
			],
			extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
		},
		server: {
			port: 5173,
			host: '0.0.0.0',
			allowedHosts: getFrontendHost(frontendUrl),
			watch: {
				usePolling: true,
			},
		},
	},
})