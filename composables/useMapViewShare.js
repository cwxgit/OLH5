import { gcj02ToWgs84 } from '../utils/coordTransform'

/**
 * 地图视图分享：把当前中心、缩放、活动图层写入 URL，并支持从 URL 还原。
 * 与 uni 剪贴板/Toast 配合，把分享链接复制到剪贴板。
 *
 * @param mapRef            地图实例 ref
 * @param viewRef           View 实例 ref
 * @param activeLayerKey    当前活动图层 key 的 ref
 * @param layerConfigs      图层配置（reactive 数组）
 * @param getMapCenterInWgs84 取当前中心 WGS-84 坐标的函数
 * @param bounds            { defaultCenter, defaultZoom, minZoom, maxZoom, nasaLayerKey, nasaMaxZoom, fallbackLayerKey }
 */
export function useMapViewShare({
	mapRef,
	viewRef,
	activeLayerKey,
	layerConfigs,
	getMapCenterInWgs84,
	bounds
}) {
	const {
		defaultCenter,
		defaultZoom,
		minZoom,
		maxZoom,
		nasaLayerKey = 'nasa',
		nasaMaxZoom = 8,
		fallbackLayerKey = 'tengxun'
	} = bounds

	function getSharedMapState() {
		const state = {
			center: defaultCenter,
			sharedCoordinate: null,
			zoom: defaultZoom,
			layerKey: activeLayerKey.value
		}
		if (typeof window === 'undefined') {
			return state
		}

		const params = new URLSearchParams(window.location.search)
		const longitudeValue = params.get('mapLng')
		const latitudeValue = params.get('mapLat')
		const longitude = Number(longitudeValue)
		const latitude = Number(latitudeValue)
		if (longitudeValue !== null && latitudeValue !== null
			&& longitudeValue.trim() !== '' && latitudeValue.trim() !== ''
			&& Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
			&& Number.isFinite(latitude) && latitude >= -90 && latitude <= 90) {
			state.center = params.get('mapCoord') === 'gcj02'
				? gcj02ToWgs84(longitude, latitude)
				: [longitude, latitude]
			state.sharedCoordinate = state.center
		}

		const zoomValue = params.get('mapZoom')
		const zoom = Number(zoomValue)
		if (zoomValue !== null && Number.isFinite(zoom)) {
			state.zoom = Math.max(minZoom, Math.min(maxZoom, zoom))
		}

		const layerKey = params.get('mapLayer')
		if (layerKey && layerConfigs.some((item) => item.key === layerKey)) {
			state.layerKey = layerKey
		}
		if (state.layerKey === nasaLayerKey && state.zoom > nasaMaxZoom) {
			state.layerKey = fallbackLayerKey
		}

		return state
	}

	async function shareMapView() {
		if (!mapRef.value || !viewRef.value || typeof window === 'undefined') {
			uni.showToast({ title: '地图尚未准备好，暂时无法分享', icon: 'none' })
			return
		}

		const center = getMapCenterInWgs84()
		const zoom = viewRef.value.getZoom()
		if (!center || !center.every(Number.isFinite) || !Number.isFinite(zoom)) {
			uni.showToast({ title: '无法读取当前地图视图', icon: 'none' })
			return
		}

		const url = new URL(window.location.href)
		url.searchParams.set('mapLng', center[0].toFixed(6))
		url.searchParams.set('mapLat', center[1].toFixed(6))
		url.searchParams.set('mapZoom', zoom.toFixed(2))
		url.searchParams.set('mapLayer', activeLayerKey.value)

		try {
			await new Promise((resolve, reject) => {
				uni.setClipboardData({
					data: url.toString(),
					success: resolve,
					fail: reject
				})
			})
			uni.showToast({ title: '地图链接已复制', icon: 'none' })
		} catch (error) {
			console.warn('复制地图分享链接失败', error)
			uni.showToast({ title: '复制失败，请检查剪贴板权限', icon: 'none' })
		}
	}

	return {
		getSharedMapState,
		shareMapView
	}
}
