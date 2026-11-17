import { ref } from 'vue'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { Fill, Stroke, Style, Text, Circle as CircleStyle } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { gcj02ToWgs84 } from '../utils/coordTransform'
import { getPlaceSearchUrl, request } from '../utils/positionApi'

/**
 * 地点搜索：调用后端 query 接口、维护结果列表、选中后绘制标记并定位地图。
 */
export function usePlaceSearch({
	viewRef,
	placeSearchSourceRef,
	getLayerConfig,
	geoZoom
}) {
	const placeSearchKeyword = ref('')
	const placeSearchResults = ref([])
	const placeSearchLoading = ref(false)
	const placeSearchLoaded = ref(false)
	const placeSearchError = ref('')
	const selectedPlaceCode = ref(null)
	const selectedPlace = ref(null)
	let placeSearchRequestId = 0
	let searchDebounceTimer = null

	function getPlaceDisplayCoordinate(gcj02) {
		return getLayerConfig().coordType === 'gcj02'
			? gcj02
			: gcj02ToWgs84(gcj02[0], gcj02[1])
	}

	function renderPlaceSearchMarker() {
		if (!placeSearchSourceRef.value) {
			return
		}
		placeSearchSourceRef.value.clear(true)
		if (!selectedPlace.value) {
			return
		}

		const displayCoord = getPlaceDisplayCoordinate([selectedPlace.value.lng, selectedPlace.value.lat])
		const feature = new Feature({
			geometry: new Point(fromLonLat(displayCoord))
		})
		feature.setStyle(new Style({
			image: new CircleStyle({
				radius: 9,
				fill: new Fill({ color: '#e5484d' }),
				stroke: new Stroke({ color: '#ffffff', width: 3 })
			}),
			text: new Text({
				text: selectedPlace.value.name,
				offsetY: -20,
				padding: [4, 6, 4, 6],
				fill: new Fill({ color: '#183153' }),
				stroke: new Stroke({ color: '#ffffff', width: 3 }),
				backgroundFill: new Fill({ color: '#ffffff' })
			})
		}))
		placeSearchSourceRef.value.addFeature(feature)
	}

	async function searchPlaces() {
		const requestId = ++placeSearchRequestId
		const keyword = placeSearchKeyword.value.trim()
		selectedPlaceCode.value = null
		selectedPlace.value = null
		renderPlaceSearchMarker()
		if (!keyword) {
			placeSearchResults.value = []
			placeSearchLoading.value = false
			placeSearchLoaded.value = false
			placeSearchError.value = ''
			return
		}
		if (Array.from(keyword).length > 100) {
			placeSearchResults.value = []
			placeSearchLoading.value = false
			placeSearchLoaded.value = false
			placeSearchError.value = '请输入地点名称（最多100个字符）'
			return
		}

		placeSearchLoading.value = true
		placeSearchLoaded.value = false
		placeSearchError.value = ''
		try {
			const response = await request({
				url: getPlaceSearchUrl(keyword),
				method: 'GET'
			})
			if (requestId !== placeSearchRequestId) {
				return
			}
			const payload = response && typeof response === 'object' && 'data' in response
				? response.data
				: null
			if (!Array.isArray(payload)) {
				throw new Error(payload && payload.message ? payload.message : '地点搜索结果格式无效')
			}
			placeSearchResults.value = payload
				.filter((place) => place
					&& place.code !== undefined
					&& place.code !== null
					&& typeof place.name === 'string'
					&& place.name.trim() !== ''
					&& place.lng !== undefined
					&& place.lng !== null
					&& place.lng !== ''
					&& place.lat !== undefined
					&& place.lat !== null
					&& place.lat !== '')
				.map((place) => ({
					...place,
					lng: Number(place.lng),
					lat: Number(place.lat)
				}))
				.filter((place) => Number.isFinite(place.lng) && Number.isFinite(place.lat)
					&& place.lng >= -180 && place.lng <= 180
					&& place.lat >= -90 && place.lat <= 90)
				.slice(0, 50)
			if (payload.length && !placeSearchResults.value.length) {
				throw new Error('地点搜索结果缺少有效名称或坐标')
			}
			placeSearchLoaded.value = true
		} catch (error) {
			if (requestId !== placeSearchRequestId) {
				return
			}
			placeSearchResults.value = []
			selectedPlaceCode.value = null
			selectedPlace.value = null
			renderPlaceSearchMarker()
			placeSearchError.value = error && error.message ? error.message : '地点搜索失败'
		} finally {
			if (requestId === placeSearchRequestId) {
				placeSearchLoading.value = false
			}
		}
	}

	function debouncedSearchPlaces(delay = 400) {
		if (searchDebounceTimer !== null) {
			clearTimeout(searchDebounceTimer)
		}
		searchDebounceTimer = setTimeout(() => {
			searchDebounceTimer = null
			searchPlaces()
		}, delay)
	}

	function clearPlaceSearch() {
		if (searchDebounceTimer !== null) {
			clearTimeout(searchDebounceTimer)
			searchDebounceTimer = null
		}
		placeSearchRequestId += 1
		placeSearchKeyword.value = ''
		placeSearchResults.value = []
		placeSearchLoading.value = false
		placeSearchLoaded.value = false
		placeSearchError.value = ''
		selectedPlaceCode.value = null
		selectedPlace.value = null
		renderPlaceSearchMarker()
	}

	function selectPlace(place) {
		selectedPlaceCode.value = place.code
		selectedPlace.value = place
		const displayCoord = getPlaceDisplayCoordinate([place.lng, place.lat])
		if (viewRef.value) {
			viewRef.value.setCenter(fromLonLat(displayCoord))
			viewRef.value.setZoom(geoZoom)
		}
		renderPlaceSearchMarker()
	}

	return {
		placeSearchKeyword,
		placeSearchResults,
		placeSearchLoading,
		placeSearchLoaded,
		placeSearchError,
		selectedPlaceCode,
		selectedPlace,
		searchPlaces,
		debouncedSearchPlaces,
		clearPlaceSearch,
		selectPlace,
		renderPlaceSearchMarker,
		getPlaceDisplayCoordinate
	}
}
