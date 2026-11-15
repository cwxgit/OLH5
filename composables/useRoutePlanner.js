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
	const navigationActive = ref(false)
	const navigationProgress = ref(0)
	const navigationStepIndex = ref(0)
	const navigationDistanceToStep = ref(0)
	const navigationRemainingDistance = ref(0)
	const navigationRouteDistance = ref(0)
	const navigationStatus = ref('')
	const navigationVoiceEnabled = ref(false)
	const navigationVoiceAvailable = ref(false)
	const pickedOrigin = ref(null)
	const pickedDestination = ref(null)
	let originPickRequestId = 0
	let destinationPickRequestId = 0
	let locationOriginInitializationHandled = false
	let originAddressResolution = null
	let lastMatchedSegment = 0
	let offRouteFixes = 0
	let lastRerouteAt = 0
	let spokenStepIndex = -1

	const EARTH_RADIUS_METERS = 6371008.8
	const OFF_ROUTE_DISTANCE_METERS = 60
	const REROUTE_COOLDOWN_MS = 30000

	function formatRouteDistance(distance) {
		return distance < 1000
			? `${Math.round(distance)} 米`
			: `${(distance / 1000).toFixed(1)} 公里`
	}

	function formatRouteDuration(duration) {
		const totalMinutes = Math.max(1, Math.round(Number(duration) || 0))
		if (totalMinutes < 60) {
			return `${totalMinutes} 分钟`
		}
		const hours = Math.floor(totalMinutes / 60)
		const minutes = totalMinutes % 60
		return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
	}

	function getNavigationSteps() {
		return Array.isArray(activeRoute.value && activeRoute.value.steps)
			? activeRoute.value.steps
			: []
	}

	const navigationStep = computed(() => getNavigationSteps()[navigationStepIndex.value] || null)
	const navigationProgressPercent = computed(() => navigationRouteDistance.value > 0
		? Math.min(100, Math.round(navigationProgress.value / navigationRouteDistance.value * 100))
		: 0)
	const navigationRemainingDuration = computed(() => {
		const route = activeRoute.value
		if (!route || navigationRouteDistance.value <= 0) {
			return 0
		}
		return Math.max(0, Number(route.duration) || 0)
			* Math.max(0, 1 - navigationProgress.value / navigationRouteDistance.value)
	})

	function distanceBetweenCoordinates(first, second) {
		const latitudeDelta = (second.lat - first.lat) * Math.PI / 180
		const longitudeDelta = (second.lng - first.lng) * Math.PI / 180
		const firstLatitude = first.lat * Math.PI / 180
		const secondLatitude = second.lat * Math.PI / 180
		const haversine = Math.sin(latitudeDelta / 2) ** 2
			+ Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2
		return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
	}

	function getRouteProgress(location) {
		const route = activeRoute.value
		if (!route || !Array.isArray(route.polyline) || route.polyline.length < 2) {
			return null
		}

		const coordinates = route.polyline
			.map(({ lat, lng }) => ({ lat: Number(lat), lng: Number(lng) }))
			.filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
		if (coordinates.length < 2) {
			return null
		}

		const cumulative = [0]
		for (let index = 1; index < coordinates.length; index += 1) {
			cumulative[index] = cumulative[index - 1]
				+ distanceBetweenCoordinates(coordinates[index - 1], coordinates[index])
		}

		let closest = null
		const searchStart = Math.max(0, lastMatchedSegment - 4)
		for (let index = searchStart; index < coordinates.length - 1; index += 1) {
			const start = coordinates[index]
			const end = coordinates[index + 1]
			const latitudeScale = Math.cos(location.lat * Math.PI / 180)
			const xScale = EARTH_RADIUS_METERS * Math.PI / 180 * latitudeScale
			const yScale = EARTH_RADIUS_METERS * Math.PI / 180
			const startX = (start.lng - location.lng) * xScale
			const startY = (start.lat - location.lat) * yScale
			const endX = (end.lng - location.lng) * xScale
			const endY = (end.lat - location.lat) * yScale
			const segmentX = endX - startX
			const segmentY = endY - startY
			const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY
			const fraction = segmentLengthSquared === 0
				? 0
				: Math.max(0, Math.min(1, -(startX * segmentX + startY * segmentY) / segmentLengthSquared))
			const crossTrackDistance = Math.hypot(startX + fraction * segmentX, startY + fraction * segmentY)
			if (!closest || crossTrackDistance < closest.distance) {
				const segmentLength = cumulative[index + 1] - cumulative[index]
				closest = {
					distance: crossTrackDistance,
					segmentIndex: index,
					progress: cumulative[index] + segmentLength * fraction
				}
			}
		}

		if (!closest) {
			return null
		}
		lastMatchedSegment = Math.max(lastMatchedSegment, closest.segmentIndex)
		return {
			distance: closest.distance,
			progress: Math.max(navigationProgress.value, closest.progress),
			total: cumulative[cumulative.length - 1]
		}
	}

	function getNavigationStep(progress, totalDistance) {
		const steps = getNavigationSteps()
		if (!steps.length) {
			return { index: 0, distance: Math.max(0, totalDistance - progress) }
		}
		const stepsDistance = steps.reduce((total, step) => {
			const distance = Number(step.distance)
			return total + (Number.isFinite(distance) && distance > 0 ? distance : 0)
		}, 0)
		if (stepsDistance <= 0 || totalDistance <= 0) {
			return { index: 0, distance: Math.max(0, totalDistance - progress) }
		}

		const scale = totalDistance / stepsDistance
		let boundary = 0
		for (let index = 0; index < steps.length; index += 1) {
			const stepDistance = Math.max(0, Number(steps[index].distance) || 0) * scale
			boundary += stepDistance
			if (progress <= boundary || index === steps.length - 1) {
				return { index, distance: Math.max(0, boundary - progress) }
			}
		}
		return { index: steps.length - 1, distance: 0 }
	}

	function speakNavigationInstruction(instruction) {
		if (!navigationVoiceEnabled.value || typeof window === 'undefined'
			|| !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
			return
		}
		window.speechSynthesis.cancel()
		const utterance = new SpeechSynthesisUtterance(instruction)
		utterance.lang = 'zh-CN'
		window.speechSynthesis.speak(utterance)
	}

	function stopNavigation(status = '') {
		navigationActive.value = false
		navigationStatus.value = status
		offRouteFixes = 0
		spokenStepIndex = -1
		if (typeof window !== 'undefined' && window.speechSynthesis) {
			window.speechSynthesis.cancel()
		}
	}

	function startNavigation() {
		if (!activeRoute.value || !Array.isArray(activeRoute.value.polyline)
			|| activeRoute.value.polyline.length < 2) {
			routeError.value = '请先规划出可用路线'
			return false
		}
		if (!userLocationWgs84.value) {
			routeError.value = '请先完成定位后再开始导航'
			return false
		}

		navigationActive.value = true
		navigationProgress.value = 0
		navigationStepIndex.value = 0
		navigationDistanceToStep.value = 0
		navigationRemainingDistance.value = Number(activeRoute.value.distance) || 0
		navigationRouteDistance.value = Number(activeRoute.value.distance) || 0
		navigationStatus.value = '正在定位路线位置…'
		lastMatchedSegment = 0
		offRouteFixes = 0
		spokenStepIndex = -1
		updateNavigationLocation(userLocationWgs84.value)
		return true
	}

	function updateNavigationLocation(wgs84) {
		if (!navigationActive.value || !Array.isArray(wgs84) || wgs84.length < 2) {
			return
		}
		const gcj02 = wgs84ToGcj02(Number(wgs84[0]), Number(wgs84[1]))
		const progress = getRouteProgress({ lng: gcj02[0], lat: gcj02[1] })
		if (!progress) {
			navigationStatus.value = '无法匹配路线位置'
			return
		}

		navigationProgress.value = progress.progress
		navigationRouteDistance.value = progress.total
		navigationRemainingDistance.value = Math.max(0, progress.total - progress.progress)
		if (progress.distance > OFF_ROUTE_DISTANCE_METERS) {
			offRouteFixes += 1
			navigationStatus.value = `已偏离路线约 ${formatRouteDistance(progress.distance)}`
			if (offRouteFixes >= 3 && !routeLoading.value
				&& Date.now() - lastRerouteAt >= REROUTE_COOLDOWN_MS) {
				void rerouteFromLocation(gcj02)
			}
		} else {
			offRouteFixes = 0
			navigationStatus.value = '导航中'
		}

		const step = getNavigationStep(progress.progress, progress.total)
		navigationStepIndex.value = step.index
		navigationDistanceToStep.value = step.distance
		if (step.index !== spokenStepIndex) {
			spokenStepIndex = step.index
			const instruction = navigationStep.value && navigationStep.value.instruction
			if (instruction) {
				speakNavigationInstruction(instruction)
			}
		}
		if (navigationRemainingDistance.value <= 15) {
			stopNavigation('已到达目的地')
		}
	}

	async function rerouteFromLocation(gcj02) {
		if (!navigationActive.value || routeLoading.value) {
			return
		}
		lastRerouteAt = Date.now()
		offRouteFixes = 0
		navigationStatus.value = '偏航，正在重新规划…'
		try {
			await planRoute({ originOverride: `${gcj02[1]},${gcj02[0]}`, preserveNavigation: true })
			if (navigationActive.value && routeOptions.value.length) {
				navigationProgress.value = 0
				navigationStepIndex.value = 0
				navigationRemainingDistance.value = Number(activeRoute.value.distance) || 0
				navigationRouteDistance.value = Number(activeRoute.value.distance) || 0
				lastMatchedSegment = 0
				navigationStatus.value = '路线已更新，继续导航'
			}
		} finally {
			if (navigationActive.value && navigationStatus.value === '偏航，正在重新规划…') {
				navigationStatus.value = '重新规划未完成，仍按原路线导航'
			}
		}
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
		const getPolylineCoordinates = (polyline) => {
			if (!Array.isArray(polyline) || polyline.length < 2) {
				return null
			}
			return polyline.map(({ lat, lng }) => {
				const wgs84 = gcj02ToWgs84(Number(lng), Number(lat))
				return fromLonLat(encodeByCoordType(wgs84, coordType))
			})
		}
		const getRouteCoordinates = (route) => getPolylineCoordinates(route && route.polyline)
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
		const trafficSegments = routeMode.value === 'driving'
			&& Array.isArray(activeRoute.value.trafficSegments)
			? activeRoute.value.trafficSegments
			: []
		activeLine.setStyle(new Style({
			stroke: new Stroke({
				color: trafficSegments.length ? '#ffffff' : '#1677ff',
				width: trafficSegments.length ? 8 : 6,
				lineCap: 'round',
				lineJoin: 'round'
			})
		}))
		routeSourceRef.value.addFeature(activeLine)
		const trafficColors = {
			0: '#12a66a',
			1: '#f5b400',
			2: '#f97316',
			3: '#94a3b8',
			4: '#e5484d'
		}
		trafficSegments.forEach((segment) => {
			const coordinates = getPolylineCoordinates(segment && segment.polyline)
			if (!coordinates) {
				return
			}
			const segmentLine = new Feature(new LineString(coordinates))
			segmentLine.setStyle(new Style({
				stroke: new Stroke({
					color: trafficColors[segment.level] || '#1677ff',
					width: 6,
					lineCap: 'round',
					lineJoin: 'round'
				})
			}))
			routeSourceRef.value.addFeature(segmentLine)
		})
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
		if (navigationActive.value) {
			navigationProgress.value = 0
			navigationStepIndex.value = 0
			navigationRemainingDistance.value = Number(activeRoute.value.distance) || 0
			navigationRouteDistance.value = Number(activeRoute.value.distance) || 0
			lastMatchedSegment = 0
			spokenStepIndex = -1
			updateNavigationLocation(userLocationWgs84.value)
		}
		renderRoute(true)
	}

	function previewRoute(index) {
		if (navigationActive.value || index < 0 || index >= routeOptions.value.length) {
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
		stopNavigation()
		if (endpoint === 'origin') {
			originPickRequestId += 1
			pickedOrigin.value = null
			originInput.value = value
		} else if (endpoint === 'destination') {
			destinationPickRequestId += 1
			pickedDestination.value = null
			destinationInput.value = value
		}
		routeOptions.value = []
		activeRouteIndex.value = 0
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
		stopNavigation()
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

	async function planRoute(options = {}) {
		if (routeLoading.value) {
			return
		}
		const preserveNavigation = options.preserveNavigation === true
		const destination = pickedDestination.value
			? `${pickedDestination.value.lat},${pickedDestination.value.lng}`
			: destinationInput.value.trim()
		if (!destination) {
			routeError.value = '请输入目的地'
			return
		}

		let origin = options.originOverride || (pickedOrigin.value
			? `${pickedOrigin.value.lat},${pickedOrigin.value.lng}`
			: originInput.value.trim())
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
		if (!preserveNavigation) {
			stopNavigation()
		}
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
			if (preserveNavigation && navigationActive.value) {
				navigationProgress.value = 0
				navigationStepIndex.value = 0
				navigationRemainingDistance.value = Number(activeRoute.value.distance) || 0
				navigationRouteDistance.value = Number(activeRoute.value.distance) || 0
				lastMatchedSegment = 0
				spokenStepIndex = -1
			}
			renderRoute(true)
		} catch (error) {
			if (!preserveNavigation) {
				routeOptions.value = []
			}
			previewRouteIndex.value = null
			renderRoute()
			routeError.value = error && error.message ? error.message : '路线规划失败，请稍后重试'
			if (preserveNavigation && navigationActive.value) {
				navigationStatus.value = '重新规划失败，仍按原路线导航'
			}
		} finally {
			routeLoading.value = false
		}
	}

	function toggleNavigationVoice() {
		if (!navigationVoiceAvailable.value) {
			routeError.value = '当前浏览器不支持语音播报'
			return
		}
		navigationVoiceEnabled.value = !navigationVoiceEnabled.value
		if (!navigationVoiceEnabled.value && typeof window !== 'undefined') {
			window.speechSynthesis.cancel()
		} else if (navigationStep.value && navigationStep.value.instruction) {
			speakNavigationInstruction(navigationStep.value.instruction)
		}
	}

	function clearRoute() {
		stopNavigation()
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

	if (typeof window !== 'undefined') {
		navigationVoiceAvailable.value = Boolean(
			window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined'
		)
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
		navigationActive,
		navigationStep,
		navigationDistanceToStep,
		navigationRemainingDistance,
		navigationProgressPercent,
		navigationRemainingDuration,
		navigationStatus,
		navigationVoiceEnabled,
		navigationVoiceAvailable,
		planRoute,
		selectRoute,
		previewRoute,
		clearRoutePreview,
		startNavigation,
		stopNavigation,
		updateNavigationLocation,
		toggleNavigationVoice,
		setRouteEndpointFromMap,
		clearRoute,
		renderRoute,
		formatRouteDistance,
		formatRouteDuration
	}
}
