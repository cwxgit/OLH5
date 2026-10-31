import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
	plugins: [uni()],
	server: {
		proxy: {
			'/admin/position': {
				target: 'http://oladmin.cc',
				changeOrigin: true
			}
		}
	}
})
