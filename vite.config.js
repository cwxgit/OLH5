import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
	plugins: [uni()],
	server: {
		proxy: {
			'/admin/position': {
				target: 'https://oladmin.cc',
				changeOrigin: true,
				configure: (proxy) => {
					proxy.on('proxyReq', (proxyRequest) => {
						proxyRequest.removeHeader('origin')
					})
				}
			}
		}
	}
})
