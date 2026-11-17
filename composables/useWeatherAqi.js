import { reactive } from 'vue'
import { gcj02ToWgs84 } from '../utils/coordTransform'
import { getCurrentWeatherUrl, getAirQualityUrl, request } from '../utils/positionApi'

/**
 * 天气与空气质量面板：从右键菜单读取目标坐标，两个面板互斥显示，
 * 通过 requestId 取消过期请求。
 *
 * @param routeContextMenu 共享的右键菜单状态（含 lat/lng/coordinateLabel）
 * @param closeRouteContextMenu 打开面板时关闭菜单的回调
 */
export function useWeatherAqi({
	routeContextMenu,
	closeRouteContextMenu
}) {
	const weatherPanel = reactive({
		visible: false,
		loading: false,
		error: '',
		coordinateLabel: '',
		mode: 'now',
		weather: null
	})
	const aqiPanel = reactive({
		visible: false,
		loading: false,
		error: '',
		coordinateLabel: '',
		airQuality: null
	})
	let weatherRequestId = 0
	let aqiRequestId = 0

	async function loadWeather(mode) {
		const requestId = ++weatherRequestId
		weatherPanel.visible = true
		weatherPanel.loading = true
		weatherPanel.error = ''
		weatherPanel.mode = mode
		weatherPanel.coordinateLabel = routeContextMenu.coordinateLabel
		weatherPanel.weather = null
		closeRouteContextMenu()
		// 天气与空气质量面板互斥，打开天气前先从页面清除空气质量面板
		closeAqiPanel()

		try {
			const response = await request({
				url: getCurrentWeatherUrl(routeContextMenu.lat, routeContextMenu.lng, mode),
				method: 'GET'
			})
			if (requestId !== weatherRequestId) {
				return
			}

			const payload = response.data
			if (!payload || payload.success !== true || !payload.weather || payload.weather.type !== mode) {
				throw new Error(payload && payload.message ? payload.message : '天气信息格式无效')
			}
			weatherPanel.weather = payload.weather
		} catch (error) {
			if (requestId === weatherRequestId) {
				weatherPanel.error = error instanceof Error ? error.message : '天气信息加载失败'
			}
		} finally {
			if (requestId === weatherRequestId) {
				weatherPanel.loading = false
			}
		}
	}

	function showCurrentWeather() {
		return loadWeather('now')
	}

	function showForecastWeather() {
		return loadWeather('future')
	}

	function closeWeatherPanel() {
		weatherRequestId += 1
		weatherPanel.visible = false
		weatherPanel.loading = false
	}

	async function loadAirQuality() {
		const requestId = ++aqiRequestId
		// routeContextMenu 保存的是 GCJ-02 坐标，WAQI 需要 WGS-84
		const [wgsLng, wgsLat] = gcj02ToWgs84(routeContextMenu.lng, routeContextMenu.lat)
		aqiPanel.visible = true
		aqiPanel.loading = true
		aqiPanel.error = ''
		aqiPanel.coordinateLabel = routeContextMenu.coordinateLabel
		aqiPanel.airQuality = null
		closeRouteContextMenu()
		// 天气与空气质量面板互斥，打开空气质量前先从页面清除天气面板
		closeWeatherPanel()

		try {
			const response = await request({
				url: getAirQualityUrl(wgsLat, wgsLng),
				method: 'GET'
			})
			if (requestId !== aqiRequestId) {
				return
			}

			const payload = response.data
			if (!payload || payload.success !== true || !payload.airQuality) {
				throw new Error(payload && payload.message ? payload.message : '空气质量数据格式无效')
			}
			aqiPanel.airQuality = payload.airQuality
		} catch (error) {
			if (requestId === aqiRequestId) {
				aqiPanel.error = error instanceof Error ? error.message : '空气质量加载失败'
			}
		} finally {
			if (requestId === aqiRequestId) {
				aqiPanel.loading = false
			}
		}
	}

	function showAqiPanel() {
		return loadAirQuality()
	}

	function closeAqiPanel() {
		aqiRequestId += 1
		aqiPanel.visible = false
		aqiPanel.loading = false
	}

	// 供 onBeforeUnmount 调用，作废所有进行中的请求
	function cancelPendingWeatherAqiRequests() {
		weatherRequestId += 1
		aqiRequestId += 1
	}

	return {
		weatherPanel,
		aqiPanel,
		showCurrentWeather,
		showForecastWeather,
		closeWeatherPanel,
		showAqiPanel,
		closeAqiPanel,
		cancelPendingWeatherAqiRequests
	}
}
