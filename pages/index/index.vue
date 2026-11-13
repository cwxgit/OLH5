<template>
	<view class="page-shell">
		<view class="workspace-layout" :class="{ 'sidebar-collapsed': !sidebarVisible }">
			<view class="sidebar-panel">
				<button class="sidebar-toggle" @click="toggleSidebar">隐藏控制栏全屏显示地图</button>
				<view class="hero-panel">
					<view class="hero-copy">
						<text class="eyebrow">OLH5 / Vue3 + OpenLayers</text>
						<text class="hero-title">移动端地图浏览与路线规划</text>
						<text class="hero-desc">
							复刻 `layers.cpxiang.tech` 的核心能力，保留原有后端接口调用路径，并针对 H5 场景优化布局与交互。
						</text>
					</view>

					<view class="hero-actions">
						<button class="geo-button" @click="locateMe">{{ geoButtonText }}</button>
						<button v-if="hasLocated" class="ghost-button" @click="recenterToUser">回到我的位置</button>
						<button class="ghost-button" @click="shareMapView">分享</button>
						<view class="link-actions">
							<text class="link-action" @click="openLink(loginUrl)">登录</text>
							<text class="link-action" @click="openLink(registerUrl)">注册</text>
						</view>
					</view>

					<view class="status-strip">
						<text class="status-pill">图层：{{ activeLayerLabel }}</text>
						<text class="status-pill">坐标：{{ activeCoordLabel }}</text>
						<text v-if="locationLabel" class="status-pill success-pill">{{ locationLabel }}</text>
					</view>
					<text class="navigation-note">{{ screenWakeLockStatus }}</text>

					<view class="place-search-card">
						<text class="route-title">地点搜索</text>
						<view class="place-search-row">
							<input
								class="place-search-input"
								type="text"
								:value="placeSearchKeyword"
								placeholder="输入地点名称"
								confirm-type="search"
								@input="placeSearchKeyword = $event.detail.value"
								@confirm="searchPlaces"
							/>
							<button class="history-button place-search-button" :disabled="placeSearchLoading" @click="searchPlaces">
								{{ placeSearchLoading ? '搜索中…' : '搜索' }}
							</button>
						</view>
						<text v-if="placeSearchError" class="place-search-message place-search-error">{{ placeSearchError }}</text>
						<view v-if="placeSearchResults.length" class="place-search-results">
							<view class="place-search-results-head">
								<text class="place-search-results-count">搜索结果（{{ placeSearchResults.length }}）</text>
								<text class="place-search-clear" role="button" @click.stop="clearPlaceSearch">×</text>
							</view>
							<view
								v-for="place in placeSearchResults"
								:key="place.code"
								class="place-search-result"
								:class="{ active: selectedPlaceCode === place.code }"
								@click="selectPlace(place)"
							>
								<text class="place-search-result-name">{{ place.name }}</text>
								<text class="place-search-result-hint">点击定位</text>
							</view>
						</view>
						<text v-else-if="placeSearchLoaded && !placeSearchError" class="place-search-message">
							没有找到匹配的地点
						</text>
					</view>

					<view class="route-card">
						<text class="route-title">国内路线规划</text>
						<input
							class="place-search-input route-input"
							type="text"
							:value="originInput"
							placeholder="起点（右键设定；留空使用当前位置）"
							@input="setRouteEndpointInput('origin', $event.detail.value)"
						/>
						<input
							class="place-search-input route-input"
							type="text"
							:value="destinationInput"
							placeholder="终点（右键地图设定或输入地址）"
							confirm-type="search"
							@input="setRouteEndpointInput('destination', $event.detail.value)"
							@confirm="planRoute"
						/>
						<text class="route-pick-hint">右键地图可选起点和终点；也可手动输入地址。</text>
						<view class="route-modes">
							<button
								v-for="mode in routeModes"
								:key="mode.key"
								class="route-mode-button"
								:class="{ active: routeMode === mode.key }"
								@click="routeMode = mode.key"
							>
								{{ mode.label }}
							</button>
						</view>
						<view class="route-actions">
							<button class="history-button" :disabled="routeLoading" @click="planRoute">
								{{ routeLoading ? '规划中…' : '规划路线' }}
							</button>
							<button v-if="routeOptions.length" class="route-clear-button" @click="clearRoute">清除路线</button>
						</view>
						<view v-if="routeOptions.length" class="navigation-card">
							<view v-if="!navigationActive" class="navigation-actions">
								<button class="navigation-button" :disabled="!hasLocated" @click="startNavigation">
									开始导航
								</button>
								<text class="navigation-note">需要允许定位；开始导航后会尝试保持屏幕常亮</text>
							</view>
							<template v-else>
								<view class="navigation-head">
									<text class="navigation-status">{{ navigationStatus }}</text>
									<view class="navigation-actions">
										<button
											v-if="navigationVoiceAvailable"
											class="navigation-voice-button"
											@click="toggleNavigationVoice"
										>
											{{ navigationVoiceEnabled ? '关闭语音' : '开启语音' }}
										</button>
										<button class="navigation-stop-button" @click="stopNavigation">结束导航</button>
									</view>
								</view>
								<text v-if="navigationStep" class="navigation-instruction">
									{{ navigationStep.instruction }}
								</text>
								<view class="navigation-progress-track">
									<view class="navigation-progress-fill" :style="{ width: `${navigationProgressPercent}%` }"></view>
								</view>
								<view class="navigation-distances">
									<text>距当前指引 {{ formatRouteDistance(navigationDistanceToStep) }}</text>
									<text>剩余 {{ formatRouteDistance(navigationRemainingDistance) }}</text>
								</view>
								<text class="navigation-eta">
									已行驶 {{ navigationProgressPercent }}% · 预计剩余 {{ formatRouteDuration(navigationRemainingDuration) }}
								</text>
							</template>
							<text v-if="!navigationActive && navigationStatus === '已到达目的地'" class="navigation-arrival">
								已到达目的地
							</text>
						</view>
						<text v-if="routeError" class="place-search-message place-search-error">{{ routeError }}</text>
						<template v-if="routeOptions.length">
							<view class="route-options">
								<view
									v-for="(route, index) in routeOptions"
									:key="index"
									class="route-option"
									:class="{ active: activeRouteIndex === index, previewing: previewRouteIndex === index }"
									@mouseenter="previewRoute(index)"
									@mouseleave="clearRoutePreview"
									@click="selectRoute(index)"
								>
									<text class="route-option-title">方案 {{ index + 1 }}</text>
									<text class="route-option-meta">
										{{ formatRouteDistance(route.distance) }} · {{ formatRouteDuration(route.duration) }}
										{{ route.toll !== null ? ` · 过路费约 ¥${route.toll}` : '' }}
										{{ route.fare !== null ? ` · 票价约 ¥${(route.fare / 100).toFixed(2)}` : '' }}
									</text>
								</view>
							</view>
							<view v-if="activeRoute && activeRoute.steps.length" class="route-steps">
								<view v-for="(step, index) in activeRoute.steps" :key="index" class="route-step">
									<text class="route-step-instruction">{{ step.instruction }}</text>
									<text v-if="step.distance" class="route-step-distance">{{ formatRouteDistance(step.distance) }}</text>
								</view>
							</view>
							<view
								v-if="routeMode === 'driving' && activeRoute && activeRoute.trafficSegments && activeRoute.trafficSegments.length"
								class="route-traffic-legend"
							>
								<text class="route-traffic-legend-title">路况</text>
								<view class="route-traffic-legend-item">
									<text class="route-traffic-dot traffic-clear"></text><text>畅通</text>
								</view>
								<view class="route-traffic-legend-item">
									<text class="route-traffic-dot traffic-slow"></text><text>缓行</text>
								</view>
								<view class="route-traffic-legend-item">
									<text class="route-traffic-dot traffic-congested"></text><text>拥堵</text>
								</view>
								<view class="route-traffic-legend-item">
									<text class="route-traffic-dot traffic-unknown"></text><text>无路况</text>
								</view>
								<view class="route-traffic-legend-item">
									<text class="route-traffic-dot traffic-severe"></text><text>严重拥堵</text>
								</view>
							</view>
							<text class="route-disclaimer">路线由腾讯位置服务提供，实际通行情况以现场为准。</text>
						</template>
					</view>

						<view class="history-card">
							<text class="history-title">位置历史与轨迹回放</text>
							<text class="history-policy">
								页面打开且定位成功后会自动记录位置，请确定浏览器会按系统设置请求定位权限。
							</text>
							<view class="history-filter">
								<view class="history-range-row">
									<text class="history-range-label">开始时间</text>
									<picker
										class="history-date-picker-wrap"
										mode="date"
										:value="historyStartDate"
										@change="handleHistoryDateChange('start', $event)"
									>
										<view class="history-date-picker">
											<text class="history-date-value">{{ historyStartDate }}</text>
										</view>
									</picker>
									<picker
										class="history-time-picker-wrap"
										mode="time"
										:value="historyStartTime"
										@change="handleHistoryTimeChange('start', $event)"
									>
										<view class="history-date-picker">
											<text class="history-date-value">{{ historyStartTime }}</text>
										</view>
									</picker>
								</view>
								<view class="history-range-row">
									<text class="history-range-label">结束时间</text>
									<picker
										class="history-date-picker-wrap"
										mode="date"
										:value="historyEndDate"
										@change="handleHistoryDateChange('end', $event)"
									>
										<view class="history-date-picker">
											<text class="history-date-value">{{ historyEndDate }}</text>
										</view>
									</picker>
									<picker
										class="history-time-picker-wrap"
										mode="time"
										:value="historyEndTime"
										@change="handleHistoryTimeChange('end', $event)"
									>
										<view class="history-date-picker">
											<text class="history-date-value">{{ historyEndTime }}</text>
										</view>
									</picker>
								</view>
								<button class="history-button" :disabled="historyLoading" @click="loadPositionHistory">
									{{ historyLoading ? '加载中…' : '查询轨迹' }}
								</button>
							</view>
							<text v-if="historyError" class="place-search-message place-search-error">{{ historyError }}</text>
							<view v-if="historyRecords.length" class="history-playback">
								<view class="history-playback-actions">
									<button class="history-button" @click="toggleHistoryPlayback">
										{{ historyPlaying ? '暂停' : '播放轨迹' }}
									</button>
									<text class="history-playback-time">{{ currentHistoryTime }}</text>
								</view>
								<slider
									class="history-slider"
									:min="0"
									:max="historyRecords.length - 1"
									:value="historyPlaybackIndex"
									:disabled="historyRecords.length < 2"
									@changing="seekHistoryPlayback"
									@change="seekHistoryPlayback"
								/>
								<text class="history-count">共 {{ historyRecords.length }} 个位置点</text>
							</view>
							<text v-else-if="historyLoaded" class="history-count">该日期没有可显示的位置记录</text>
						</view>
				</view>

				<MapLayerPanel
					:layers="layerConfigs"
					:active-layer-key="activeLayerKey"
					:weather-layer-enabled="weatherLayerEnabled"
					:weather-layer-error="weatherLayerError"
					:ees-disabled-hint="eesDisabledHint"
					@change-layer="changeLayer"
					@toggle-weather-layer="toggleWeatherLayer"
				/>
			</view>

			<view class="map-panel">
				<button v-if="!sidebarVisible" class="sidebar-toggle sidebar-toggle-floating" @click="toggleSidebar">显示控制栏</button>
				<MeasurementTools
					:mode="measurementMode"
					:measurements="measurements"
					:format-distance="formatDistance"
					:format-area="formatArea"
					:format-measurement="formatMeasurement"
					@start="startMeasurement"
					@clear="clearMeasurements"
					@remove="removeMeasurement"
				/>
				<view id="ol-map" class="map-canvas"></view>
				<WeatherDetailPanel
					:visible="weatherPanel.visible"
					:loading="weatherPanel.loading"
					:error="weatherPanel.error"
					:mode="weatherPanel.mode"
					:weather="weatherPanel.weather"
					:coordinate-label="weatherPanel.coordinateLabel"
					@close="closeWeatherPanel"
				/>
				<MapLayerPanel
					:layers="layerConfigs"
					:active-layer-key="activeLayerKey"
					:weather-layer-enabled="weatherLayerEnabled"
					:weather-layer-error="weatherLayerError"
					:ees-disabled-hint="eesDisabledHint"
					overlay
					@change-layer="changeLayer"
					@toggle-weather-layer="toggleWeatherLayer"
				/>
				<MapContextMenu
					:visible="routeContextMenu.visible"
					:left="routeContextMenu.left"
					:top="routeContextMenu.top"
					:coordinate-label="routeContextMenu.coordinateLabel"
					@select-endpoint="setMapRouteEndpoint"
					@show-current-weather="showCurrentWeather"
					@show-forecast-weather="showForecastWeather"
				/>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import MapContextMenu from '../../components/MapContextMenu.vue'
import MapLayerPanel from '../../components/MapLayerPanel.vue'
import MeasurementTools from '../../components/MeasurementTools.vue'
import WeatherDetailPanel from '../../components/WeatherDetailPanel.vue'
import 'ol/ol.css'
import Map from 'ol/Map'
import View from 'ol/View'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import CircleGeom from 'ol/geom/Circle'
import { defaults as defaultControls, ScaleLine } from 'ol/control'
import { Fill, Stroke, Style, Text, Circle as CircleStyle } from 'ol/style'
import { fromLonLat, toLonLat } from 'ol/proj'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../../utils/coordTransform'
import { useMeasurements } from '../../composables/useMeasurements'
import { useLocation } from '../../composables/useLocation'
import { usePositionHistory } from '../../composables/usePositionHistory'
import { useRoutePlanner } from '../../composables/useRoutePlanner'
import { buildBaseLayers, buildRainViewerLayers, refreshRainViewerLayer } from '../../utils/mapLayers'
import {
	getPlaceSearchUrl,
	getCurrentWeatherUrl,
	loginUrl,
	registerUrl,
	request,
	resolveAppUrl
} from '../../utils/positionApi'

const DEFAULT_CENTER = [116.405285, 39.904989]
const DEFAULT_CENTER_ZOOM = 8
const MIN_MAP_ZOOM = 3
const MAX_MAP_ZOOM = 18
const GEO_ZOOM = 16
const routeModes = [
	{ key: 'driving', label: '驾车' },
	{ key: 'walking', label: '步行' },
	{ key: 'bicycling', label: '骑行' },
	{ key: 'transit', label: '公交' }
]
const mapRef = ref(null)
const viewRef = ref(null)
const measurementSourceRef = ref(null)
const historySourceRef = ref(null)
const routeSourceRef = ref(null)
const placeSearchSourceRef = ref(null)
const mapTargetElement = ref(null)
const sidebarVisible = ref(true)
const positionFeatureRef = ref(null)
const accuracyFeatureRef = ref(null)
const sharedCoordinateFeatureRef = ref(null)
const markerSourceWgs84 = ref(null)
const sharedCoordinateWgs84 = ref(null)
const userLocationWgs84 = ref(null)
const currentAccuracy = ref(0)
const hasLocated = ref(false)
const locating = ref(false)
const locationLabel = ref('')
const activeLayerKey = ref('tengxun')
const weatherLayerEnabled = reactive({ radar: false })
const weatherLayerError = ref('')
const eesDisabledHint = ref(false)
const measurementMode = ref('')
const measurementInProgress = ref(false)
const measurements = ref([])
const historyStartDate = ref(getLocalDate())
const historyStartTime = ref('00:00')
const historyEndDate = ref(getLocalDate())
const historyEndTime = ref('23:59')
const historyRecords = ref([])
const historyPlaybackIndex = ref(0)
const historyPlaying = ref(false)
const historyLoading = ref(false)
const historyLoaded = ref(false)
const historyError = ref('')
const placeSearchKeyword = ref('')
const placeSearchResults = ref([])
const placeSearchLoading = ref(false)
const placeSearchLoaded = ref(false)
const placeSearchError = ref('')
const selectedPlaceCode = ref(null)
const selectedPlace = ref(null)
let placeSearchRequestId = 0
let weatherRequestId = 0
let rainViewerRefreshTimer = null
let rainViewerRequestId = 0
let rainViewerHasFrame = false
const routeContextMenu = reactive({
	visible: false,
	left: 0,
	top: 0,
	lat: 0,
	lng: 0,
	coordinateLabel: ''
})
const weatherPanel = reactive({
	visible: false,
	loading: false,
	error: '',
	coordinateLabel: '',
	mode: 'now',
	weather: null
})

const layerConfigs = reactive([
	{ key: 'tengxun', label: 'Tengxun', coordType: 'gcj02', coordLabel: 'gcj02', note: '', disabled: false },
	{ key: 'osm', label: 'OSM', coordType: 'wgs84', coordLabel: 'wgs84', note: '需翻墙', disabled: false },
	{ key: 'google', label: 'Google Satellites', coordType: 'wgs84', coordLabel: 'wgs84', note: '需翻墙', disabled: false },
	{ key: 'gaode', label: 'Gaode Maps', coordType: 'gcj02', coordLabel: 'gcj02', note: '', disabled: false },
	{ key: 'arcgis', label: 'Arc Maps', coordType: 'wgs84', coordLabel: 'wgs84', note: '', disabled: false },
	{ key: 'nasa', label: 'NASA Viirs', coordType: 'wgs84', coordLabel: 'wgs84', note: '', disabled: false }
])

const {
	startMeasurement,
	stopMeasurement,
	renderMeasurements,
	formatMeasurement,
	formatDistance,
	formatArea,
	removeMeasurement,
	clearMeasurements
} = useMeasurements({
	mapRef,
	measurementSourceRef,
	measurementMode,
	measurementInProgress,
	measurements,
	getLayerConfig,
	encodeByCoordType,
	decodeByCoordType
})

let initializeRouteOriginFromLocation = () => {}
let updateRouteNavigationFromLocation = () => {}

const {
	startPositionTracking,
	trackingEnabled: locationTrackingEnabled,
	disableLocationTracking,
	locateMe,
	recenterToUser
} = useLocation({
	markerSourceWgs84,
	userLocationWgs84,
	currentAccuracy,
	hasLocated,
	locating,
	locationLabel,
	viewRef,
	geoZoom: GEO_ZOOM,
	setMapCenterByWgs84,
	renderMarker,
	onLocationSuccess: (location) => {
		initializeRouteOriginFromLocation(location)
		updateRouteNavigationFromLocation(location)
	}
})

const {
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
} = useRoutePlanner({
	mapRef,
	routeSourceRef,
	userLocationWgs84,
	getLayerConfig,
	encodeByCoordType
})

initializeRouteOriginFromLocation = setRouteOriginFromLocation
updateRouteNavigationFromLocation = updateNavigationLocation

const keepScreenAwake = computed(() => navigationActive.value || locationTrackingEnabled.value)
const screenWakeLockStatus = ref('持续定位期间会尝试保持屏幕常亮')
let screenWakeLock = null
let screenWakeLockRequestId = 0
let screenWakeLockPending = false

async function requestScreenWakeLock() {
	if (!keepScreenAwake.value) {
		return
	}
	if (typeof navigator === 'undefined' || !navigator.wakeLock || !navigator.wakeLock.request) {
		screenWakeLockStatus.value = '当前浏览器不支持自动保持屏幕常亮'
		return
	}
	if (screenWakeLock && !screenWakeLock.released) {
		screenWakeLockStatus.value = '屏幕常亮已开启'
		return
	}
	if (screenWakeLockPending) {
		return
	}

	screenWakeLock = null
	const requestId = ++screenWakeLockRequestId
	screenWakeLockPending = true
	try {
		const wakeLock = await navigator.wakeLock.request('screen')
		if (requestId !== screenWakeLockRequestId || !keepScreenAwake.value
			|| (typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
			await wakeLock.release()
			return
		}

		screenWakeLock = wakeLock
		screenWakeLockStatus.value = '屏幕常亮已开启'
		wakeLock.addEventListener('release', () => {
			if (screenWakeLock === wakeLock) {
				screenWakeLock = null
				screenWakeLockStatus.value = keepScreenAwake.value
					? '屏幕常亮已暂停，返回页面后将重试'
					: '屏幕常亮已关闭'
			}
		}, { once: true })
	} catch (error) {
		if (requestId === screenWakeLockRequestId && keepScreenAwake.value) {
			screenWakeLockStatus.value = '无法保持屏幕常亮，请检查浏览器与系统设置'
			console.warn('Screen Wake Lock request failed:', error)
		}
	} finally {
		if (requestId === screenWakeLockRequestId) {
			screenWakeLockPending = false
		}
	}
}

function releaseScreenWakeLock() {
	screenWakeLockRequestId += 1
	screenWakeLockPending = false
	const wakeLock = screenWakeLock
	screenWakeLock = null
	screenWakeLockStatus.value = '屏幕常亮已关闭'
	if (wakeLock && !wakeLock.released) {
		wakeLock.release().catch((error) => {
			console.warn('Screen Wake Lock release failed:', error)
		})
	}
}

function handleVisibilityChange() {
	if (!keepScreenAwake.value) {
		return
	}
	if (document.visibilityState === 'visible') {
		requestScreenWakeLock()
	} else {
		screenWakeLockStatus.value = '页面切到后台时，浏览器可能暂停屏幕常亮'
	}
}

watch(keepScreenAwake, (active) => {
	if (active) {
		requestScreenWakeLock()
	} else {
		releaseScreenWakeLock()
	}
}, { flush: 'sync', immediate: true })

function handleMapContextMenu(event) {
	if (!mapRef.value || !mapTargetElement.value) {
		return
	}
	event.preventDefault()

	const displayCoordinate = toLonLat(mapRef.value.getEventCoordinate(event))
	const wgs84 = decodeByCoordType(displayCoordinate, getLayerConfig().coordType)
	if (!wgs84) {
		return
	}
	const [longitude, latitude] = wgs84ToGcj02(wgs84[0], wgs84[1])
	const targetRect = mapTargetElement.value.getBoundingClientRect()
	const menuWidth = 188
	const menuHeight = 160
	const x = event.clientX - targetRect.left
	const y = event.clientY - targetRect.top

	routeContextMenu.lat = latitude
	routeContextMenu.lng = longitude
	routeContextMenu.coordinateLabel = `${longitude.toFixed(6)}, ${latitude.toFixed(6)}`
	routeContextMenu.left = Math.max(8, Math.min(x, targetRect.width - menuWidth - 8))
	routeContextMenu.top = Math.max(8, Math.min(y, targetRect.height - menuHeight - 8))
	routeContextMenu.visible = true
}

function closeRouteContextMenu() {
	routeContextMenu.visible = false
}

function handleDocumentPointerDown(event) {
	if (event.target instanceof Element
		&& (event.target.closest('.route-context-menu') || event.target.closest('#ol-map'))) {
		return
	}
	closeRouteContextMenu()
}

function setMapRouteEndpoint(endpoint) {
	const selected = setRouteEndpointFromMap(endpoint, {
		lat: routeContextMenu.lat,
		lng: routeContextMenu.lng
	})
	if (selected) {
		closeRouteContextMenu()
	}
}

async function loadWeather(mode) {
	const requestId = ++weatherRequestId
	weatherPanel.visible = true
	weatherPanel.loading = true
	weatherPanel.error = ''
	weatherPanel.mode = mode
	weatherPanel.coordinateLabel = routeContextMenu.coordinateLabel
	weatherPanel.weather = null
	closeRouteContextMenu()

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

const {
	handleHistoryDateChange,
	handleHistoryTimeChange,
	loadPositionHistory,
	renderPositionHistory,
	seekHistoryPlayback,
	toggleHistoryPlayback,
	stopHistoryPlayback
} = usePositionHistory({
	historyStartDate,
	historyStartTime,
	historyEndDate,
	historyEndTime,
	historyRecords,
	historyPlaybackIndex,
	historyPlaying,
	historyLoading,
	historyLoaded,
	historyError,
	historySourceRef,
	mapRef,
	viewRef,
	getLayerConfig,
	encodeByCoordType
})

const activeLayerLabel = computed(() => {
	const current = layerConfigs.find((item) => item.key === activeLayerKey.value)
	return current ? current.label : '-'
})

const activeCoordLabel = computed(() => {
	const current = layerConfigs.find((item) => item.key === activeLayerKey.value)
	return current ? current.coordLabel : '-'
})

const geoButtonText = computed(() => {
	if (locating.value) {
		return '定位中...'
	}

	return hasLocated.value ? '重新定位' : '定位到我的位置'
})

const currentHistoryTime = computed(() => {
	const record = historyRecords.value[historyPlaybackIndex.value]
	return record ? record.datetime : ''
})

function getLocalDate() {
	const date = new Date()
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function getLayerConfig(key = activeLayerKey.value) {
	return layerConfigs.find((item) => item.key === key) || layerConfigs[0]
}

function getSharedMapState() {
	const state = {
		center: DEFAULT_CENTER,
		sharedCoordinate: null,
		zoom: DEFAULT_CENTER_ZOOM,
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
		state.zoom = Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom))
	}

	const layerKey = params.get('mapLayer')
	if (layerKey && layerConfigs.some((item) => item.key === layerKey)) {
		state.layerKey = layerKey
	}
	if (state.layerKey === 'nasa' && state.zoom > 8) {
		state.layerKey = 'tengxun'
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

function encodeByCoordType(wgs84, coordType) {
	if (!wgs84) {
		return null
	}

	return coordType === 'gcj02' ? wgs84ToGcj02(wgs84[0], wgs84[1]) : wgs84
}

function decodeByCoordType(coord, coordType) {
	if (!coord) {
		return null
	}

	return coordType === 'gcj02' ? gcj02ToWgs84(coord[0], coord[1]) : coord
}

function setMapCenterByWgs84(wgs84, zoom) {
	if (!viewRef.value || !wgs84) {
		return
	}

	const currentLayer = getLayerConfig()
	const displayCoord = encodeByCoordType(wgs84, currentLayer.coordType)
	viewRef.value.setCenter(fromLonLat(displayCoord))
	if (typeof zoom === 'number') {
		viewRef.value.setZoom(zoom)
	}
}

function getMapCenterInWgs84() {
	if (!viewRef.value) {
		return DEFAULT_CENTER
	}

	const currentLayer = getLayerConfig()
	const displayCoord = toLonLat(viewRef.value.getCenter())
	return decodeByCoordType(displayCoord, currentLayer.coordType)
}

function renderMarker() {
	if (!positionFeatureRef.value || !accuracyFeatureRef.value || !sharedCoordinateFeatureRef.value) {
		return
	}

	const currentLayer = getLayerConfig()
	if (markerSourceWgs84.value) {
		const displayCoord = encodeByCoordType(markerSourceWgs84.value, currentLayer.coordType)
		positionFeatureRef.value.setGeometry(new Point(fromLonLat(displayCoord)))
	} else {
		positionFeatureRef.value.setGeometry(null)
	}

	if (sharedCoordinateWgs84.value) {
		const displayCoord = encodeByCoordType(sharedCoordinateWgs84.value, currentLayer.coordType)
		sharedCoordinateFeatureRef.value.setGeometry(new Point(fromLonLat(displayCoord)))
	} else {
		sharedCoordinateFeatureRef.value.setGeometry(null)
	}

	if (userLocationWgs84.value && currentAccuracy.value > 0) {
		const displayCoord = encodeByCoordType(userLocationWgs84.value, currentLayer.coordType)
		accuracyFeatureRef.value.setGeometry(new CircleGeom(fromLonLat(displayCoord), currentAccuracy.value))
	} else {
		accuracyFeatureRef.value.setGeometry(null)
	}
}

function updateLayerAvailability() {
	if (!viewRef.value) {
		return
	}

	const zoom = Math.round(viewRef.value.getZoom() || DEFAULT_CENTER_ZOOM)
	const nasaLayer = layerConfigs.find((item) => item.key === 'nasa')
	if (!nasaLayer) {
		return
	}

	nasaLayer.disabled = zoom > 8
	eesDisabledHint.value = nasaLayer.disabled
	if (nasaLayer.disabled && activeLayerKey.value === 'nasa') {
		changeLayer('tengxun')
	}
}

function setLayerVisible(key) {
	if (!mapRef.value) {
		return
	}

	mapRef.value.getLayers().forEach((layer) => {
		if (layer.get('role') !== 'base') {
			return
		}

		layer.setVisible(layer.get('layerKey') === key)
	})
}

function getRainViewerLayer() {
	return mapRef.value?.getLayers().getArray().find((layer) => (
		layer.get('role') === 'weather' && layer.get('weatherKey') === 'radar'
	))
}

async function updateRainViewerLayer() {
	const requestId = ++rainViewerRequestId
	const layer = getRainViewerLayer()
	if (!layer) {
		return false
	}

	try {
		await refreshRainViewerLayer(layer)
		if (requestId !== rainViewerRequestId || !weatherLayerEnabled.radar) {
			return false
		}
		rainViewerHasFrame = true
		weatherLayerError.value = ''
		layer.setVisible(true)
		return true
	} catch (error) {
		console.error('RainViewer radar update failed:', error)
		if (requestId === rainViewerRequestId) {
			weatherLayerError.value = 'RainViewer 雷达数据暂时无法加载，请稍后重试'
			if (!rainViewerHasFrame) {
				layer.setVisible(false)
			}
		}
		return false
	}
}

function toggleWeatherLayer(key) {
	if (key !== 'radar') {
		return
	}

	weatherLayerEnabled.radar = !weatherLayerEnabled.radar
	const layer = getRainViewerLayer()
	if (!weatherLayerEnabled.radar) {
		rainViewerRequestId += 1
		if (rainViewerRefreshTimer !== null) {
			clearInterval(rainViewerRefreshTimer)
			rainViewerRefreshTimer = null
		}
		layer?.setVisible(false)
		weatherLayerError.value = ''
		return
	}

	if (rainViewerHasFrame) {
		layer?.setVisible(true)
	}
	void updateRainViewerLayer().then((loaded) => {
		if (loaded && weatherLayerEnabled.radar && rainViewerRefreshTimer === null) {
			rainViewerRefreshTimer = setInterval(() => {
				if (weatherLayerEnabled.radar) {
					void updateRainViewerLayer()
				}
			}, 5 * 60 * 1000)
		}
	})
}

function changeLayer(key) {
	const targetLayer = getLayerConfig(key)
	if (!targetLayer || targetLayer.disabled) {
		return
	}
	if (measurementInProgress.value) {
		uni.showToast({ title: '请先完成当前测量再切换图层', icon: 'none' })
		return
	}

	const centerWgs84 = getMapCenterInWgs84()
	activeLayerKey.value = key
	setLayerVisible(key)
	setMapCenterByWgs84(centerWgs84)
	renderMarker()
	renderMeasurements()
	renderRoute()
	renderPositionHistory(false)
	renderPlaceSearchMarker()
}

function toggleSidebar() {
	sidebarVisible.value = !sidebarVisible.value
	nextTick(() => {
		requestAnimationFrame(() => mapRef.value && mapRef.value.updateSize())
	})
}

function openLink(url) {
	if (typeof window !== 'undefined') {
		window.open(resolveAppUrl(url), '_blank')
	}
}

async function searchPlaces() {
	const requestId = ++placeSearchRequestId
	const keyword = placeSearchKeyword.value.trim()
	selectedPlaceCode.value = null
	selectedPlace.value = null
	renderPlaceSearchMarker()
	if (!keyword || Array.from(keyword).length > 100) {
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

function clearPlaceSearch() {
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
		viewRef.value.setZoom(GEO_ZOOM)
	}
	renderPlaceSearchMarker()
}

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

async function initMap() {
	await nextTick()
	const sharedMapState = getSharedMapState()
	activeLayerKey.value = sharedMapState.layerKey
	sharedCoordinateWgs84.value = sharedMapState.sharedCoordinate
	const center = encodeByCoordType(sharedMapState.center, getLayerConfig().coordType)

	const positionFeature = new Feature()
	positionFeature.setStyle(
		new Style({
			image: new CircleStyle({
				radius: 7,
				fill: new Fill({ color: '#2f7dff' }),
				stroke: new Stroke({ color: '#ff9a62', width: 3 })
			})
		})
	)

	const accuracyFeature = new Feature()
	const sharedCoordinateFeature = new Feature()
	sharedCoordinateFeature.setStyle(new Style({
		image: new CircleStyle({
			radius: 9,
			fill: new Fill({ color: '#1769ff' }),
			stroke: new Stroke({ color: '#ffffff', width: 3 })
		})
	}))
	const overlayLayer = new VectorLayer({
		source: new VectorSource({ features: [accuracyFeature, positionFeature, sharedCoordinateFeature] }),
		style: new Style({
			fill: new Fill({ color: 'rgba(47, 125, 255, 0.15)' }),
			stroke: new Stroke({ color: 'rgba(47, 125, 255, 0.5)', width: 2 })
		})
	})
	overlayLayer.set('role', 'overlay')

	const measurementSource = new VectorSource()
	const measurementLayer = new VectorLayer({ source: measurementSource })
	measurementLayer.set('role', 'measurement')
	const historySource = new VectorSource()
	const historyLayer = new VectorLayer({ source: historySource })
	historyLayer.set('role', 'history')
	const routeSource = new VectorSource()
	const routeLayer = new VectorLayer({ source: routeSource })
	routeLayer.set('role', 'route')
	const placeSearchSource = new VectorSource()
	const placeSearchLayer = new VectorLayer({ source: placeSearchSource })
	placeSearchLayer.set('role', 'place-search')

	positionFeatureRef.value = positionFeature
	accuracyFeatureRef.value = accuracyFeature
	sharedCoordinateFeatureRef.value = sharedCoordinateFeature
	measurementSourceRef.value = measurementSource
	historySourceRef.value = historySource
	routeSourceRef.value = routeSource
	placeSearchSourceRef.value = placeSearchSource
	markerSourceWgs84.value = null

	const baseLayers = buildBaseLayers()
	baseLayers.forEach((layer) => {
		layer.setVisible(layer.get('layerKey') === activeLayerKey.value)
	})
	const weatherLayers = buildRainViewerLayers()
	weatherLayers.forEach((layer) => {
		layer.setVisible(weatherLayerEnabled[layer.get('weatherKey')])
	})

	viewRef.value = new View({
		center: fromLonLat(center),
		zoom: sharedMapState.zoom,
		maxZoom: MAX_MAP_ZOOM,
		minZoom: MIN_MAP_ZOOM
	})

	mapRef.value = new Map({
		target: 'ol-map',
		pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
		layers: baseLayers.concat(weatherLayers, routeLayer, overlayLayer, historyLayer, measurementLayer, placeSearchLayer),
		view: viewRef.value,
		controls: defaultControls().extend([
			new ScaleLine({ units: 'metric' })
		])
	})
	mapTargetElement.value = mapRef.value.getTargetElement()
	if (mapTargetElement.value) {
		mapTargetElement.value.addEventListener('contextmenu', handleMapContextMenu)
	}
	mapRef.value.on('singleclick', closeRouteContextMenu)
	if (typeof document !== 'undefined') {
		document.addEventListener('pointerdown', handleDocumentPointerDown)
	}

	viewRef.value.on('change:resolution', () => {
		updateLayerAvailability()
	})

	renderMarker()
	renderRoute()
	renderPlaceSearchMarker()
	updateLayerAvailability()
	}

onMounted(() => {
	initMap()
	startPositionTracking()
	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', handleVisibilityChange)
	}
})

onBeforeUnmount(() => {
	weatherRequestId += 1
	rainViewerRequestId += 1
	if (rainViewerRefreshTimer !== null) {
		clearInterval(rainViewerRefreshTimer)
		rainViewerRefreshTimer = null
	}
	if (typeof document !== 'undefined') {
		document.removeEventListener('visibilitychange', handleVisibilityChange)
	}
	disableLocationTracking()
	stopHistoryPlayback()
	stopMeasurement()
	stopNavigation()
	if (mapTargetElement.value) {
		mapTargetElement.value.removeEventListener('contextmenu', handleMapContextMenu)
	}
	if (typeof document !== 'undefined') {
		document.removeEventListener('pointerdown', handleDocumentPointerDown)
	}
	if (mapRef.value) {
		mapRef.value.un('singleclick', closeRouteContextMenu)
	}
	if (mapRef.value) {
		mapRef.value.setTarget(undefined)
	}
	mapTargetElement.value = null
	positionFeatureRef.value = null
	accuracyFeatureRef.value = null
	sharedCoordinateFeatureRef.value = null
	sharedCoordinateWgs84.value = null
	measurementSourceRef.value = null
	historySourceRef.value = null
	routeSourceRef.value = null
	placeSearchSourceRef.value = null
})
</script>

<style>
.page-shell {
	min-height: 100vh;
	padding: 24rpx 24rpx 32rpx;
	box-sizing: border-box;
	background:
		radial-gradient(circle at top left, rgba(255, 196, 121, 0.28), transparent 30%),
		linear-gradient(180deg, #f7f4ec 0%, #efe7d8 44%, #d8ddd1 100%);
	font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;
	color: #183153;
}

.workspace-layout {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 24rpx;
}

.sidebar-panel {
	display: contents;
}

.hero-panel,
.layer-panel {
	min-width: 0;
}

.sidebar-toggle {
	display: block;
	align-self: flex-end;
	box-sizing: border-box;
	width: 100%;
	margin: 0;
	padding: 0 18px;
	height: 36px;
	line-height: 36px;
	border: 0;
	border-radius: 8px;
	background: #0f766e;
	color: #ffffff;
	font-size: 14px;
}

.sidebar-toggle::after {
	border: 0;
}

.hero-panel {
	position: relative;
	padding: 28rpx;
	border-radius: 28rpx;
	background: rgba(255, 252, 247, 0.88);
	backdrop-filter: blur(14px);
	box-shadow: 0 18rpx 42rpx rgba(52, 74, 94, 0.12);
}

.eyebrow {
	display: block;
	font-size: 22rpx;
	letter-spacing: 4rpx;
	text-transform: uppercase;
	color: #bc6c25;
}

.hero-title {
	display: block;
	margin-top: 14rpx;
	font-size: 44rpx;
	line-height: 1.2;
	font-weight: 700;
	color: #243b53;
}

.hero-desc {
	display: block;
	margin-top: 14rpx;
	font-size: 26rpx;
	line-height: 1.65;
	color: #52606d;
}

.hero-actions {
	display: flex;
	gap: 16rpx;
	margin-top: 24rpx;
	flex-wrap: wrap;
}

.geo-button,
.ghost-button {
	margin: 0;
	height: 84rpx;
	line-height: 84rpx;
	padding: 0 28rpx;
	border-radius: 999rpx;
	font-size: 28rpx;
	font-weight: 600;
}

.geo-button {
	background: linear-gradient(135deg, #1d4ed8 0%, #0f766e 100%);
	color: #ffffff;
	box-shadow: 0 14rpx 28rpx rgba(15, 118, 110, 0.22);
}

.geo-button::after,
.ghost-button::after {
	border: 0;
}

.ghost-button {
	background: rgba(36, 59, 83, 0.08);
	color: #243b53;
}

.status-strip {
	display: flex;
	gap: 12rpx;
	margin-top: 22rpx;
	flex-wrap: wrap;
}

.status-pill {
	padding: 10rpx 18rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	background: rgba(36, 59, 83, 0.08);
	color: #243b53;
}

.success-pill {
	background: rgba(15, 118, 110, 0.12);
	color: #0f766e;
}

.link-actions {
	display: flex;
	align-items: center;
	gap: 20rpx;
	margin-left: auto;
}

.link-action {
	font-size: 26rpx;
	font-weight: 600;
	color: #0f766e;
}

.place-search-input {
	box-sizing: border-box;
	width: 100%;
	height: 76rpx;
	padding: 0 22rpx;
	border: 2rpx solid rgba(36, 59, 83, 0.12);
	border-radius: 16rpx;
	background: #fffdfa;
	font-size: 26rpx;
	color: #243b53;
}

.place-search-message {
	font-size: 22rpx;
	color: #7b8794;
}

.place-search-message {
	display: block;
	padding: 20rpx;
}

.place-search-error {
	color: #b42318;
}

.place-search-card {
	margin-top: 18rpx;
	padding: 20rpx;
	border: 2rpx solid rgba(15, 118, 110, 0.16);
	border-radius: 20rpx;
	background: rgba(15, 118, 110, 0.05);
}

.place-search-row {
	display: flex;
	align-items: center;
	gap: 12rpx;
}

.place-search-row .place-search-input {
	flex: 1;
	min-width: 0;
}

.place-search-button {
	min-width: 112rpx;
}

.place-search-results {
	max-height: 420rpx;
	overflow-y: auto;
}

.place-search-results-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 12rpx;
	padding: 8rpx 10rpx;
	border-bottom: 1rpx solid rgba(36, 59, 83, 0.1);
}

.place-search-results-count {
	font-size: 21rpx;
	color: #627d98;
}

.place-search-clear {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	background: #fff0f0;
	color: #d92d20;
	font-size: 38rpx;
	line-height: 1;
	font-weight: 700;
	cursor: pointer;
}

.place-search-result {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
	padding: 16rpx 10rpx;
	border-top: 1rpx solid rgba(36, 59, 83, 0.1);
	cursor: pointer;
}

.place-search-result.active .place-search-result-name {
	color: #0f766e;
	font-weight: 700;
}

.place-search-result-name {
	min-width: 0;
	font-size: 24rpx;
	color: #243b53;
}

.place-search-result-hint {
	flex: none;
	font-size: 20rpx;
	color: #627d98;
}

.route-card {
	margin-top: 18rpx;
	padding: 20rpx;
	border: 2rpx solid rgba(22, 119, 255, 0.18);
	border-radius: 20rpx;
	background: rgba(22, 119, 255, 0.04);
}

.route-title {
	display: block;
	margin-bottom: 12rpx;
	font-size: 28rpx;
	font-weight: 700;
	color: #243b53;
}

.route-pick-hint {
	display: block;
	margin-top: 8rpx;
	font-size: 21rpx;
	line-height: 1.5;
	color: #627d98;
}

.route-input {
	margin-top: 10rpx;
}

.route-modes,
.route-actions {
	display: flex;
	align-items: center;
	gap: 10rpx;
	margin-top: 12rpx;
}

.navigation-card {
	margin-top: 12rpx;
	padding: 14rpx;
	border: 1rpx solid rgba(15, 118, 110, 0.18);
	border-radius: 14rpx;
	background: rgba(15, 118, 110, 0.06);
}

.navigation-actions,
.navigation-head,
.navigation-distances {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.navigation-actions {
	flex-wrap: wrap;
}

.navigation-head {
	justify-content: space-between;
}

.navigation-status {
	font-size: 22rpx;
	font-weight: 700;
	color: #0f766e;
}

.navigation-note {
	font-size: 20rpx;
	color: #627d98;
}

.navigation-button,
.navigation-voice-button,
.navigation-stop-button {
	margin: 0;
	padding: 0 16rpx;
	height: 58rpx;
	line-height: 58rpx;
	border: 0;
	border-radius: 12rpx;
	font-size: 21rpx;
}

.navigation-button::after,
.navigation-voice-button::after,
.navigation-stop-button::after {
	border: 0;
}

.navigation-button {
	background: #0f766e;
	color: #ffffff;
}

.navigation-button[disabled] {
	background: #d1d5db;
	color: #6b7280;
}

.navigation-voice-button {
	background: #e0f2fe;
	color: #075985;
}

.navigation-stop-button {
	background: #fff0ed;
	color: #b42318;
}

.navigation-instruction {
	display: block;
	margin-top: 10rpx;
	font-size: 26rpx;
	font-weight: 700;
	line-height: 1.5;
	color: #183153;
}

.navigation-progress-track {
	height: 8rpx;
	margin-top: 12rpx;
	border-radius: 999rpx;
	background: rgba(15, 118, 110, 0.16);
	overflow: hidden;
}

.navigation-progress-fill {
	height: 100%;
	border-radius: inherit;
	background: #0f766e;
	transition: width 180ms ease;
}

.navigation-distances {
	justify-content: space-between;
	margin-top: 8rpx;
	font-size: 21rpx;
	color: #52606d;
}

.navigation-eta {
	display: block;
	margin-top: 6rpx;
	font-size: 20rpx;
	color: #627d98;
}

.navigation-arrival {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	font-weight: 700;
	color: #0f766e;
}

.route-mode-button,
.route-clear-button {
	margin: 0;
	padding: 0 16rpx;
	height: 62rpx;
	line-height: 62rpx;
	border: 0;
	border-radius: 14rpx;
	background: #e8edf2;
	color: #243b53;
	font-size: 22rpx;
}

.route-mode-button::after,
.route-clear-button::after {
	border: 0;
}

.route-mode-button.active {
	background: #1677ff;
	color: #ffffff;
}

.route-clear-button {
	background: #fff0ed;
	color: #b42318;
}

.route-options {
	margin-top: 12rpx;
	border: 1rpx solid rgba(36, 59, 83, 0.1);
	border-radius: 14rpx;
	overflow: hidden;
}

.route-option {
	display: flex;
	flex-direction: column;
	gap: 4rpx;
	padding: 14rpx 16rpx;
	border-bottom: 1rpx solid rgba(36, 59, 83, 0.08);
	background: #fffdfa;
}

.route-option:last-child {
	border-bottom: 0;
}

.route-option.active,
.route-option.previewing {
	background: rgba(22, 119, 255, 0.1);
}

.route-option-title {
	font-size: 23rpx;
	font-weight: 700;
	color: #243b53;
}

.route-option-meta,
.route-disclaimer {
	font-size: 21rpx;
	color: #d0093a;
}

.route-steps {
	max-height: 360rpx;
	margin-top: 12rpx;
	overflow-y: auto;
}

.route-step {
	display: flex;
	justify-content: space-between;
	gap: 12rpx;
	padding: 10rpx 2rpx;
	border-bottom: 1rpx solid rgba(36, 59, 83, 0.08);
}

.route-step-instruction {
	flex: 1;
	font-size: 22rpx;
	line-height: 1.5;
	color: #243b53;
}

.route-step-distance {
	flex: none;
	font-size: 20rpx;
	color: #7b8794;
}

.route-disclaimer {
	display: block;
	margin-top: 10rpx;
	line-height: 1.5;
}

.route-traffic-legend {
	display: flex;
	align-items: center;
	gap: 12rpx 20rpx;
	flex-wrap: wrap;
	margin-top: 12rpx;
	padding: 12rpx 16rpx;
	border-radius: 12rpx;
	background: rgba(36, 59, 83, 0.05);
	font-size: 20rpx;
	color: #52606d;
}

.route-traffic-legend-title,
.route-traffic-legend-item {
	display: inline-flex;
	align-items: center;
	gap: 8rpx;
}

.route-traffic-legend-title {
	font-weight: 700;
	color: #243b53;
}

.route-traffic-dot {
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
}

.traffic-clear {
	background: #12a66a;
}

.traffic-slow {
	background: #f5b400;
}

.traffic-congested {
	background: #f97316;
}

.traffic-unknown {
	background: #94a3b8;
}

.traffic-severe {
	background: #e5484d;
}

.history-card {
	margin-top: 18rpx;
	padding: 20rpx;
	border: 2rpx solid rgba(15, 118, 110, 0.16);
	border-radius: 20rpx;
	background: rgba(15, 118, 110, 0.05);
}

.history-title,
.history-policy,
.history-count {
	display: block;
}

.history-title {
	font-size: 28rpx;
	font-weight: 700;
	color: #243b53;
}

.history-policy {
	margin-top: 8rpx;
	font-size: 22rpx;
	line-height: 1.55;
	color: #52606d;
}

.history-filter,
.history-playback-actions {
	display: flex;
	align-items: center;
	gap: 10rpx;
	margin-top: 12rpx;
}

.history-filter {
	flex-direction: column;
	align-items: stretch;
}

.history-range-row {
	display: flex;
	align-items: center;
	gap: 8rpx;
}

.history-range-label {
	flex: none;
	width: 100rpx;
	font-size: 21rpx;
	color: #627d98;
}

.history-date-picker-wrap {
	flex: 1;
	min-width: 0;
}

.history-time-picker-wrap {
	flex: none;
	width: 112rpx;
}

.history-date-picker {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	box-sizing: border-box;
	height: 68rpx;
	padding: 0 16rpx;
	border: 1rpx solid #d9e2ec;
	border-radius: 14rpx;
	background: #ffffff;
}

.history-date-value {
	flex: 1;
	min-width: 0;
	text-align: center;
	font-size: 22rpx;
	color: #243b53;
}

.history-button {
	flex: none;
	margin: 0;
	padding: 0 16rpx;
	height: 68rpx;
	line-height: 68rpx;
	border: 0;
	border-radius: 14rpx;
	background: #0f766e;
	color: #ffffff;
	font-size: 22rpx;
}

.history-button::after {
	border: 0;
}

.history-button[disabled] {
	opacity: 0.45;
}

.history-stop-button {
	background: #9f3a38;
}

.history-playback {
	margin-top: 12rpx;
	padding-top: 10rpx;
	border-top: 1rpx solid rgba(36, 59, 83, 0.12);
}

.history-playback-actions {
	justify-content: space-between;
}

.history-playback-time {
	min-width: 0;
	font-size: 22rpx;
	font-weight: 600;
	color: #243b53;
}

.history-slider {
	margin: 4rpx 0;
}

.history-count {
	font-size: 21rpx;
	color: #52606d;
}

.map-panel {
	position: relative;
	height: 60vh;
	min-height: 420px;
	border-radius: 30rpx;
	overflow: hidden;
	box-shadow: 0 24rpx 56rpx rgba(36, 59, 83, 0.18);
	background: #dbe3da;
}

.sidebar-toggle-floating {
	position: absolute;
	z-index: 2;
	right: 12px;
	bottom: 12px;
	width: auto;
}

.workspace-layout.sidebar-collapsed {
	position: fixed;
	inset: 0;
	z-index: 20;
	height: 100vh;
	height: 100dvh;
	grid-template-columns: minmax(0, 1fr);
	grid-template-rows: minmax(0, 1fr);
	gap: 0;
}

.workspace-layout.sidebar-collapsed .sidebar-panel {
	display: none;
}

.workspace-layout.sidebar-collapsed .map-panel {
	grid-column: 1;
	height: 100%;
	min-height: 0;
	border-radius: 0;
}

.map-canvas {
	width: 100%;
	height: 100%;
}

:deep(.ol-zoom) {
	left: 22rpx;
	top: 22rpx;
	right: auto;
	background: rgba(255, 255, 255, 0.86);
	border-radius: 18rpx;
	padding: 8rpx;
}

:deep(.ol-zoom button),
:deep(.ol-scale-line) {
	border-radius: 14rpx;
}

:deep(.ol-attribution) {
	background: rgba(255, 255, 255, 0.82);
	border-radius: 16rpx 0 0 0;
}

:deep(.ol-scale-line) {
	left: 22rpx;
	bottom: 22rpx;
	background: rgba(16, 24, 32, 0.12);
	border: 0;
	padding: 10rpx 14rpx;
}

@media screen and (min-width: 768px) and (hover: hover) and (pointer: fine) {
	.page-shell {
		padding: 24px;
	}

	.workspace-layout {
		grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
		align-items: stretch;
		gap: 24px;
		min-height: calc(100vh - 48px);
	}

	.sidebar-panel {
		display: flex;
		flex-direction: column;
		gap: 16px;
		align-self: stretch;
		min-height: 580px;
	}

	.sidebar-panel > .hero-panel {
		flex: 1 0 auto;
	}

	.workspace-layout.sidebar-collapsed .sidebar-panel {
		display: none;
	}

	.sidebar-toggle {
		display: block;
	}

	.sidebar-toggle-floating {
		display: block;
		top: 12px;
		right: auto;
		bottom: auto;
		left: 12px;
	}

	.hero-panel {
		padding: 24px;
	}

	.map-panel {
		height: auto;
		min-height: 580px;
		grid-column: auto;
		align-self: stretch;
	}

	.workspace-layout.sidebar-collapsed {
		position: static;
		inset: auto;
		height: auto;
		grid-template-rows: auto;
		gap: 24px;
	}

	.workspace-layout.sidebar-collapsed .map-panel {
		height: auto;
		min-height: 580px;
		border-radius: 30rpx;
	}

	.sidebar-panel > .layer-panel {
		display: none;
	}

	.map-panel {
		margin-top: 0;
	}

	:deep(.ol-scale-line) {
		background: rgba(16, 24, 32, 0.72);
	}

	:deep(.ol-scale-line-inner) {
		border-color: #ffb703;
		color: #ffb703;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
	}

	.workspace-layout.sidebar-collapsed {
		grid-template-columns: minmax(0, 1fr);
	}
}

@media screen and (min-width: 1200px) and (hover: hover) and (pointer: fine) {
	.workspace-layout {
		grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
	}
}
</style>
