<template>
	<view class="page-shell">
		<view class="workspace-layout" :class="{ 'sidebar-collapsed': !sidebarVisible }">
			<view class="sidebar-panel">
				<button class="sidebar-toggle" @click="toggleSidebar">隐藏控制栏全屏显示地图</button>
				<view class="hero-panel">
					<view class="hero-copy">
						<text class="eyebrow">OLH5 / Vue3 + OpenLayers</text>
						<text class="hero-title">移动端地图浏览与路线规划</text>
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
								@input="handlePlaceSearchInput"
								@confirm="searchPlaces"
							/>
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
				<AirQualityPanel
					:visible="aqiPanel.visible"
					:loading="aqiPanel.loading"
					:error="aqiPanel.error"
					:air-quality="aqiPanel.airQuality"
					:coordinate-label="aqiPanel.coordinateLabel"
					@close="closeAqiPanel"
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
					@show-aqi="showAqiPanel"
				/>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import MapContextMenu from '../../components/MapContextMenu.vue'
import AirQualityPanel from '../../components/AirQualityPanel.vue'

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
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style'
import { fromLonLat, toLonLat } from 'ol/proj'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../../utils/coordTransform'
import { useMeasurements } from '../../composables/useMeasurements'
import { useLocation } from '../../composables/useLocation'
import { usePositionHistory } from '../../composables/usePositionHistory'
import { useRoutePlanner } from '../../composables/useRoutePlanner'
import { useScreenWakeLock } from '../../composables/useScreenWakeLock'
import { usePlaceSearch } from '../../composables/usePlaceSearch'
import { useMapContextMenu } from '../../composables/useMapContextMenu'
import { useWeatherAqi } from '../../composables/useWeatherAqi'
import { useMapViewShare } from '../../composables/useMapViewShare'
import { buildBaseLayers, buildRainViewerLayers, buildAirQualityLayers, refreshRainViewerLayer } from '../../utils/mapLayers'
import { loginUrl, registerUrl, resolveAppUrl } from '../../utils/positionApi'

const DEFAULT_CENTER = [116.405285, 39.904989]
const DEFAULT_CENTER_ZOOM = 8
const MIN_MAP_ZOOM = 3
const MAX_MAP_ZOOM = 18
const GEO_ZOOM = 16
const NASA_MAX_ZOOM = 8
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
const weatherLayerEnabled = reactive({ radar: false, 'aqi-pm25': false })
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
let rainViewerRefreshTimer = null
let rainViewerRequestId = 0
let rainViewerHasFrame = false

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
const { screenWakeLockStatus, handleVisibilityChange } = useScreenWakeLock({ keepScreenAwake })

const {
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
	renderPlaceSearchMarker
} = usePlaceSearch({
	viewRef,
	placeSearchSourceRef,
	getLayerConfig,
	geoZoom: GEO_ZOOM
})

function handlePlaceSearchInput(event) {
	placeSearchKeyword.value = event.detail.value
	debouncedSearchPlaces()
}

const {
	routeContextMenu,
	handleMapContextMenu,
	closeRouteContextMenu,
	handleDocumentPointerDown,
	setMapRouteEndpoint,
	cleanupRouteContextMenu
} = useMapContextMenu({
	mapRef,
	mapTargetElement,
	getLayerConfig,
	decodeByCoordType,
	setRouteEndpointFromMap
})

const {
	weatherPanel,
	aqiPanel,
	showCurrentWeather,
	showForecastWeather,
	closeWeatherPanel,
	showAqiPanel,
	closeAqiPanel,
	cancelPendingWeatherAqiRequests
} = useWeatherAqi({
	routeContextMenu,
	closeRouteContextMenu
})

const { getSharedMapState, shareMapView } = useMapViewShare({
	mapRef,
	viewRef,
	activeLayerKey,
	layerConfigs,
	getMapCenterInWgs84,
	bounds: {
		defaultCenter: DEFAULT_CENTER,
		defaultZoom: DEFAULT_CENTER_ZOOM,
		minZoom: MIN_MAP_ZOOM,
		maxZoom: MAX_MAP_ZOOM,
		nasaLayerKey: 'nasa',
		nasaMaxZoom: NASA_MAX_ZOOM,
		fallbackLayerKey: 'tengxun'
	}
})

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

	nasaLayer.disabled = zoom > NASA_MAX_ZOOM
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
		weatherLayerEnabled[key] = !weatherLayerEnabled[key]
		const layer = mapRef.value?.getLayers().getArray().find((item) => (
			item.get('role') === 'weather' && item.get('weatherKey') === key
		))
		layer?.setVisible(weatherLayerEnabled[key])
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
	const weatherLayers = buildRainViewerLayers().concat(buildAirQualityLayers())
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
	cancelPendingWeatherAqiRequests()
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
	cleanupRouteContextMenu()
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

<style scoped src="./index.css"></style>
