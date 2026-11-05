import { computed, ref } from 'vue'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../utils/coordTransform'
import { getReverseGeocodeUrl, getRoutePlannerUrl, request } from '../utils/positionApi'

export function useRoutePlanner({
	mapRef,
	routeSourceRef,
	userLocationWgs84,
	getLayerConfig,
	encodeByCoordType
}) {
	const originInput = ref('')
	const destinationInput = ref('')
	const routeMode = ref('driving')
	const routeLoading = ref(false)
	const routeError = ref('')
	const routeOptions = ref([])
	const activeRouteIndex = ref(0)
	const previewRouteIndex = ref(null)
	const activeRoute = computed(() => routeOptions.value[activeRouteIndex.value] || null)
	const pickedOrigin = ref(null)
	const pickedDestination = ref(null)
	let originPickRequestId = 0
	let destinationPickRequestId = 0
	let locationOriginInitializationHandled = false
	let originAddressResolution = null

	function formatRouteDistance(distance) {
		return distance < 1000
			? `${Math.round(distance)} 米`
			: `${(distance / 1000).toFixed(1)} 公里`
	}

	function formatRouteDuration(duration) {
		if (duration < 60) {
			return `${Math.max(1, Math.round(duration))} 分钟`
		}
		const hours = Math.floor(duration / 60)
		const minutes = Math.round(duration % 60)
		return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
	}

	function renderRoute(fitMap = false) {
		if (!routeSourceRef.value) {
			return
		}
		routeSourceRef.value.clear(true)

		const markerStyle = (color) => new Style({
			image: new CircleStyle({
				radius: 8,
				fill: new Fill({ color }),
				stroke: new Stroke({ color: '#ffffff', width: 3 })
			})
		})
		const addEndpointMarker = (coordinate, color) => {
			const marker = new Feature(new Point(coordinate))
			marker.setStyle(markerStyle(color))
			routeSourceRef.value.addFeature(marker)
		}
		const coordType = getLayerConfig().coordType
		const getRouteCoordinates = (route) => {
			if (!route || !Array.isArray(route.polyline) || route.polyline.length < 2) {
				return null
			}
			return route.polyline.map(({ lat, lng }) => {
				const wgs84 = gcj02ToWgs84(Number(lng), Number(lat))
				return fromLonLat(encodeByCoordType(wgs84, coordType))
			})
		}
		const activeCoordinates = getRouteCoordinates(activeRoute.value)
		if (!activeCoordinates) {
			const pickedEndpoints = [
				[pickedOrigin.value, '#0f766e'],
				[pickedDestination.value, '#d92d20']
			]
			pickedEndpoints.forEach(([point, color]) => {
				if (!point) {
					return
				}
				const wgs84 = gcj02ToWgs84(Number(point.lng), Number(point.lat))
				addEndpointMarker(fromLonLat(encodeByCoordType(wgs84, coordType)), color)
			})
			return
		}

		const activeLine = new Feature(new LineString(activeCoordinates))
		activeLine.setStyle(new Style({
			stroke: new Stroke({ color: '#1677ff', width: 6, lineCap: 'round', lineJoin: 'round' })
		}))
		routeSourceRef.value.addFeature(activeLine)
		addEndpointMarker(activeCoordinates[0], '#0f766e')
		addEndpointMarker(activeCoordinates[activeCoordinates.length - 1], '#d92d20')

		if (previewRouteIndex.value !== null && previewRouteIndex.value !== activeRouteIndex.value) {
			const previewCoordinates = getRouteCoordinates(routeOptions.value[previewRouteIndex.value])
			if (previewCoordinates) {
				const previewLine = new Feature(new LineString(previewCoordinates))
				previewLine.setStyle(new Style({
					stroke: new Stroke({
						color: '#f97316',
						width: 4,
						lineDash: [10, 8],
						lineCap: 'round',
						lineJoin: 'round'
					})
				}))
				routeSourceRef.value.addFeature(previewLine)
			}
		}

		if (fitMap && mapRef.value) {
			mapRef.value.getView().fit(activeLine.getGeometry().getExtent(), {
				padding: [80, 40, 40, 40],
				maxZoom: 16,
				duration: 300
			})
		}
	}

	function selectRoute(index) {
		if (index < 0 || index >= routeOptions.value.length) {
			return
		}
		activeRouteIndex.value = index
		previewRouteIndex.value = null
		renderRoute(true)
	}

	function previewRoute(index) {
		if (index < 0 || index >= routeOptions.value.length) {
			return
		}
		previewRouteIndex.value = index
		renderRoute()
	}

	function clearRoutePreview() {
		if (previewRouteIndex.value === null) {
			return
		}
		previewRouteIndex.value = null
		renderRoute()
	}

	function setRouteEndpointInput(endpoint, value) {
		if (endpoint === 'origin') {
			originPickRequestId += 1
			pickedOrigin.value = null
			originInput.value = value
		} else if (endpoint === 'destination') {
			destinationPickRequestId += 1
			pickedDestination.value = null
			destinationInput.value = value
		}
		previewRouteIndex.value = null
		renderRoute()
	}

	async function resolvePickedEndpointAddress(endpoint, endpointPick, requestId, errorLabel) {
		try {
			const response = await request({
				url: getReverseGeocodeUrl(endpointPick.lat, endpointPick.lng),
				method: 'GET'
			})
			const payload = response && typeof response === 'object' && 'data' in response
				? response.data
				: null
			if (!payload || payload.success !== true || typeof payload.address !== 'string' || !payload.address.trim()) {
				throw new Error(payload && payload.message ? payload.message : '地点名称解析结果无效')
			}

			const latestRequestId = endpoint === 'origin' ? originPickRequestId : destinationPickRequestId
			if (requestId !== latestRequestId) {
				return
			}
			if (endpoint === 'origin') {
				originInput.value = payload.address.trim()
			} else {
				destinationInput.value = payload.address.trim()
			}
		} catch (error) {
			const latestRequestId = endpoint === 'origin' ? originPickRequestId : destinationPickRequestId
			if (requestId === latestRequestId) {
				if (endpoint === 'origin') {
					originInput.value = ''
				} else {
					destinationInput.value = ''
				}
				routeError.value = error && error.message
					? `${errorLabel}：${error.message}`
					: errorLabel
			}
		}
	}

	async function setRouteOriginFromLocation(wgs84) {
		if (locationOriginInitializationHandled) {
			return false
		}
		locationOriginInitializationHandled = true
		if (originInput.value.trim() || pickedOrigin.value
			|| !Array.isArray(wgs84) || wgs84.length < 2
			|| !Number.isFinite(Number(wgs84[0])) || !Number.isFinite(Number(wgs84[1]))) {
			return false
		}

		const gcj02 = wgs84ToGcj02(Number(wgs84[0]), Number(wgs84[1]))
		const endpointPick = {
			lat: Number(gcj02[1].toFixed(6)),
			lng: Number(gcj02[0].toFixed(6))
		}
		const requestId = ++originPickRequestId
		pickedOrigin.value = endpointPick
		originInput.value = ''
		routeError.value = ''
		renderRoute()
		originAddressResolution = resolvePickedEndpointAddress(
			'origin',
			endpointPick,
			requestId,
			'定位起点地名解析失败'
		)
		await originAddressResolution
		return true
	}

	async function setRouteEndpointFromMap(endpoint, point) {
		if (!point) {
			return false
		}
		const latitude = Number(point && point.lat)
		const longitude = Number(point && point.lng)
		if (!['origin', 'destination'].includes(endpoint)
			|| !Number.isFinite(latitude)
			|| !Number.isFinite(longitude)
			|| latitude < -90
			|| latitude > 90
			|| longitude < -180
			|| longitude > 180) {
			return false
		}

		const endpointPick = {
			lat: Number(latitude.toFixed(6)),
			lng: Number(longitude.toFixed(6))
		}
		let requestId
		if (endpoint === 'origin') {
			requestId = ++originPickRequestId
			pickedOrigin.value = endpointPick
			originInput.value = ''
		} else if (endpoint === 'destination') {
			requestId = ++destinationPickRequestId
			pickedDestination.value = endpointPick
			destinationInput.value = ''
		} else {
			return false
		}
		routeOptions.value = []
		activeRouteIndex.value = 0
		previewRouteIndex.value = null
		routeError.value = ''
		renderRoute()
		const addressResolution = resolvePickedEndpointAddress(
			endpoint,
			endpointPick,
			requestId,
			'已选坐标，但地点名称解析失败'
		)
		if (endpoint === 'origin') {
			originAddressResolution = addressResolution
		}
		await addressResolution
		return true
	}

	async function planRoute() {
		if (routeLoading.value) {
			return
		}
		const destination = pickedDestination.value
			? `${pickedDestination.value.lat},${pickedDestination.value.lng}`
			: destinationInput.value.trim()
		if (!destination) {
			routeError.value = '请输入目的地'
			return
		}

		let origin = pickedOrigin.value
			? `${pickedOrigin.value.lat},${pickedOrigin.value.lng}`
			: originInput.value.trim()
		if (!origin && userLocationWgs84.value) {
			const gcj02 = wgs84ToGcj02(userLocationWgs84.value[0], userLocationWgs84.value[1])
			origin = `${gcj02[1]},${gcj02[0]}`
		}
		if (!origin) {
			routeError.value = '请输入起点，或先定位以使用当前位置'
			return
		}

		routeLoading.value = true
		routeError.value = ''
		try {
			if (pickedOrigin.value && !originInput.value.trim() && originAddressResolution) {
				await originAddressResolution
			}
			const response = await request({
				url: getRoutePlannerUrl(origin, destination, routeMode.value),
				method: 'GET'
			})
			const payload = response && typeof response === 'object' && 'data' in response
				? response.data
				: null
			if (!payload || payload.success !== true || !Array.isArray(payload.routes)) {
				throw new Error(payload && payload.message ? payload.message : '路线数据格式无效')
			}
			routeOptions.value = payload.routes
			activeRouteIndex.value = 0
			previewRouteIndex.value = null
			if (!routeOptions.value.length) {
				routeError.value = '没有找到可用路线'
				renderRoute()
				return
			}
			renderRoute(true)
		} catch (error) {
			routeOptions.value = []
			previewRouteIndex.value = null
			renderRoute()
			routeError.value = error && error.message ? error.message : '路线规划失败，请稍后重试'
		} finally {
			routeLoading.value = false
		}
	}

	function clearRoute() {
		routeOptions.value = []
		activeRouteIndex.value = 0
		previewRouteIndex.value = null
		routeError.value = ''
		pickedOrigin.value = null
		pickedDestination.value = null
		originPickRequestId += 1
		destinationPickRequestId += 1
		renderRoute()
	}

	return {
		originInput,
		destinationInput,
		setRouteEndpointInput,
		setRouteOriginFromLocation,
		routeMode,
		routeLoading,
		routeError,
		routeOptions,
		activeRoute,
		activeRouteIndex,
		previewRouteIndex,
		planRoute,
		selectRoute,
		previewRoute,
		clearRoutePreview,
		setRouteEndpointFromMap,
		clearRoute,
		renderRoute,
		formatRouteDistance,
		formatRouteDuration
	}
}
