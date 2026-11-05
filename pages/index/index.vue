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
								:class="{ active: routeMode === mode.key, disabled: mode.key === 'transit' }"
								:disabled="mode.key === 'transit'"
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

				<view class="layer-panel">
					<view class="layer-panel-head">
						<text class="layer-title">底图切换</text>
					</view>
					<view class="layer-list">
						<view
							v-for="layer in layerConfigs"
							:key="layer.key"
							class="layer-item"
							:class="{ disabled: layer.disabled }"
							@click="changeLayer(layer.key)"
						>
							<view class="layer-radio" :class="{ active: activeLayerKey === layer.key, disabled: layer.disabled }"></view>
							<view class="layer-meta">
								<text class="layer-name">{{ layer.label }}</text>
								<text class="layer-extra">{{ layer.coordLabel }}{{ layer.note ? ' / ' + layer.note : '' }}</text>
							</view>
						</view>
					</view>
					<view v-if="eesDisabledHint" class="layer-hint">
						NASA Viirs 图层仅在缩放级别小于等于 8 时可用，当前缩放过大，已自动禁用。
					</view>
				</view>
			</view>

			<view class="map-panel">
				<button v-if="!sidebarVisible" class="sidebar-toggle sidebar-toggle-floating" @click="toggleSidebar">显示控制栏</button>
				<view class="route-map-hint">鼠标右击地图选择路线起点或终点</view>
				<view class="measurement-tools">
					<view class="measurement-buttons">
						<button
							class="measurement-button"
							:class="{ active: measurementMode === 'distance' }"
							@click="startMeasurement('distance')"
						>
							{{ measurementMode === 'distance' ? '退出测距' : '多点测距' }}
						</button>
						<button
							class="measurement-button"
							:class="{ active: measurementMode === 'area' }"
							@click="startMeasurement('area')"
						>
							{{ measurementMode === 'area' ? '退出绘制' : '面积测量' }}
						</button>
						<button
							class="measurement-button"
							:class="{ active: measurementMode === 'circle' }"
							@click="startMeasurement('circle')"
						>
							{{ measurementMode === 'circle' ? '退出圆形测量' : '圆形测量' }}
						</button>
						<button
							v-if="measurements.length"
							class="measurement-button measurement-clear"
							@click="clearMeasurements"
						>
							清除
						</button>
					</view>
					<text v-if="measurementMode" class="measurement-hint">
						{{ measurementMode === 'distance'
							? '左键依次添加节点，左键双击完成测距'
							: measurementMode === 'circle'
								? '左键点击圆心并移动鼠标预览半径，左键双击完成'
								: '左键描绘区域，左键双击完成并闭合' }}
					</text>
					<view v-if="measurements.length" class="measurement-results">
						<view
							v-for="item in measurements"
							:key="item.id"
							class="measurement-result"
							:class="{ 'circle-result': item.type === 'circle' }"
						>
							<template v-if="item.type === 'circle'">
								<text class="measurement-result-label">周长</text>
								<text class="measurement-result-value">{{ formatDistance(item.perimeter) }}</text>
								<text class="measurement-result-label">面积</text>
								<text class="measurement-result-value">{{ formatArea(item.area) }}</text>
							</template>
							<template v-else>
								<text class="measurement-result-label">{{ item.type === 'distance' ? '距离' : '面积' }}</text>
								<text class="measurement-result-value">{{ formatMeasurement(item) }}</text>
							</template>
							<text class="measurement-result-remove" @click="removeMeasurement(item.id)">×</text>
						</view>
					</view>
				</view>
				<view id="ol-map" class="map-canvas"></view>
				<view
					v-if="routeContextMenu.visible"
					class="route-context-menu"
					:style="{ left: `${routeContextMenu.left}px`, top: `${routeContextMenu.top}px` }"
					@click.stop
				>
					<text class="route-context-title">设定路线位置</text>
					<text class="route-context-coordinate">{{ routeContextMenu.coordinateLabel }}</text>
					<view class="route-context-action" @click="setMapRouteEndpoint('origin')">设为起点</view>
					<view class="route-context-action" @click="setMapRouteEndpoint('destination')">设为终点</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
import { buildBaseLayers } from '../../utils/mapLayers'
import {
	loginUrl,
	registerUrl,
	resolveAppUrl
} from '../../utils/positionApi'

const DEFAULT_CENTER = [116.405285, 39.904989]
const DEFAULT_CENTER_ZOOM = 8
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
const mapTargetElement = ref(null)
const sidebarVisible = ref(true)
const positionFeatureRef = ref(null)
const accuracyFeatureRef = ref(null)
const markerSourceWgs84 = ref(null)
const userLocationWgs84 = ref(null)
const currentAccuracy = ref(0)
const hasLocated = ref(false)
const locating = ref(false)
const locationLabel = ref('')
const activeLayerKey = ref('tengxun')
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
const routeContextMenu = reactive({
	visible: false,
	left: 0,
	top: 0,
	lat: 0,
	lng: 0,
	coordinateLabel: ''
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

const {
	startPositionTracking,
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
	onLocationSuccess: (location) => initializeRouteOriginFromLocation(location)
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
	planRoute,
	selectRoute,
	previewRoute,
	clearRoutePreview,
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
	const menuHeight = 126
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
	if (!positionFeatureRef.value || !accuracyFeatureRef.value) {
		return
	}

	const currentLayer = getLayerConfig()
	if (markerSourceWgs84.value) {
		const displayCoord = encodeByCoordType(markerSourceWgs84.value, currentLayer.coordType)
		positionFeatureRef.value.setGeometry(new Point(fromLonLat(displayCoord)))
	} else {
		positionFeatureRef.value.setGeometry(null)
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
	const center = encodeByCoordType(DEFAULT_CENTER, getLayerConfig().coordType)

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
	const overlayLayer = new VectorLayer({
		source: new VectorSource({ features: [accuracyFeature, positionFeature] }),
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

	positionFeatureRef.value = positionFeature
	accuracyFeatureRef.value = accuracyFeature
	measurementSourceRef.value = measurementSource
	historySourceRef.value = historySource
	routeSourceRef.value = routeSource
	markerSourceWgs84.value = null

	viewRef.value = new View({
		center: fromLonLat(center),
		zoom: DEFAULT_CENTER_ZOOM,
		maxZoom: 18,
		minZoom: 3
	})

	mapRef.value = new Map({
		target: 'ol-map',
		layers: buildBaseLayers().concat(routeLayer, overlayLayer, historyLayer, measurementLayer),
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
	updateLayerAvailability()
	}

onMounted(() => {
	initMap()
	startPositionTracking()
})

onBeforeUnmount(() => {
	disableLocationTracking()
	stopHistoryPlayback()
	stopMeasurement()
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
	measurementSourceRef.value = null
	historySourceRef.value = null
	routeSourceRef.value = null
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

.route-mode-button.disabled {
	background: #e5e7eb;
	color: #9ca3af;
	opacity: 1;
	cursor: not-allowed;
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
	color: #627d98;
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

.route-map-hint {
	position: absolute;
	z-index: 3;
	left: 12px;
	bottom: 12px;
	max-width: calc(100% - 24px);
	padding: 8px 12px;
	border: 1px solid rgba(24, 49, 83, 0.12);
	border-radius: 8px;
	background: rgba(255, 253, 250, 0.94);
	box-shadow: 0 4px 12px rgba(24, 49, 83, 0.12);
	color: #243b53;
	font-size: 12px;
	pointer-events: none;
}

.route-context-menu {
	position: absolute;
	z-index: 10;
	box-sizing: border-box;
	width: 188px;
	padding: 8px;
	border: 1px solid rgba(24, 49, 83, 0.14);
	border-radius: 10px;
	background: #fffdfa;
	box-shadow: 0 10px 28px rgba(24, 49, 83, 0.24);
}

.route-context-title,
.route-context-coordinate {
	display: block;
	padding: 4px 8px;
}

.route-context-title {
	font-size: 13px;
	font-weight: 700;
	color: #243b53;
}

.route-context-coordinate {
	font-size: 11px;
	color: #627d98;
}

.route-context-action {
	padding: 9px 8px;
	border-radius: 6px;
	color: #243b53;
	font-size: 13px;
	cursor: pointer;
}

.route-context-action:hover {
	background: rgba(22, 119, 255, 0.1);
	color: #1677ff;
}

.measurement-tools {
	position: absolute;
	z-index: 3;
	top: 12px;
	right: 12px;
	box-sizing: border-box;
	width: min(340px, calc(100% - 24px));
	max-height: calc(100% - 24px);
	padding: 10px;
	border: 1px solid rgba(24, 49, 83, 0.12);
	border-radius: 12px;
	background: rgba(255, 253, 250, 0.94);
	box-shadow: 0 8px 24px rgba(24, 49, 83, 0.18);
	backdrop-filter: blur(8px);
}

.measurement-buttons {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
}

.measurement-button {
	margin: 0;
	padding: 0 10px;
	height: 34px;
	line-height: 34px;
	border: 0;
	border-radius: 8px;
	background: #e8edf2;
	color: #243b53;
	font-size: 12px;
}

.measurement-button::after {
	border: 0;
}

.measurement-button.active {
	background: #0f766e;
	color: #ffffff;
}

.measurement-button.measurement-clear {
	margin-left: auto;
	background: #fff0ed;
	color: #b42318;
}

.measurement-hint {
	display: block;
	margin-top: 8px;
	font-size: 12px;
	line-height: 1.5;
	color: #52606d;
}

.measurement-results {
	max-height: 180px;
	margin-top: 8px;
	overflow-y: auto;
	border-top: 1px solid rgba(36, 59, 83, 0.12);
}

.measurement-result {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 2px 2px;
	font-size: 12px;
}

.measurement-result.circle-result {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr) auto;
}

.measurement-result-label {
	flex: none;
	color: #52606d;
}

.measurement-result-value {
	flex: 1;
	min-width: 0;
	font-weight: 600;
	color: #183153;
}

.measurement-result-remove {
	flex: none;
	padding: 0 4px;
	color: #b42318;
	font-size: 18px;
	line-height: 1;
}

.layer-panel {
	padding: 20rpx;
	border-radius: 24rpx;
	background: rgba(16, 24, 32, 0.82);
	backdrop-filter: blur(10px);
	color: #ffffff;
}

.layer-list {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
}

.layer-panel-head {
	margin-bottom: 10rpx;
}

.layer-title {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
}

.layer-item {
	display: flex;
	align-items: center;
	gap: 14rpx;
	padding: 16rpx 0;
	border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}

.layer-item:last-child {
	border-bottom: 0;
}

.layer-item.disabled {
	opacity: 0.45;
}

.layer-radio {
	width: 24rpx;
	height: 24rpx;
	border-radius: 50%;
	border: 3rpx solid rgba(255, 255, 255, 0.5);
	background: transparent;
}

.layer-radio.active {
	background: #ffb703;
	border-color: #ffb703;
	box-shadow: 0 0 0 6rpx rgba(255, 183, 3, 0.18);
}

.layer-radio.disabled {
	border-color: rgba(255, 255, 255, 0.18);
}

.layer-meta {
	flex: 1;
	min-width: 0;
}

.layer-name,
.layer-extra {
	display: block;
}

.layer-name {
	font-size: 26rpx;
	font-weight: 600;
}

.layer-extra {
	margin-top: 6rpx;
	font-size: 20rpx;
	color: rgba(255, 255, 255, 0.72);
}

.layer-hint {
	margin-top: 16rpx;
	padding: 16rpx;
	border-radius: 16rpx;
	background: rgba(255, 214, 10, 0.12);
	font-size: 22rpx;
	line-height: 1.55;
	color: #ffe082;
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

	.layer-panel {
		padding: 18px 22px;
	}

	.layer-panel-head {
		display: block;
	}

	.layer-list {
		grid-template-columns: minmax(0, 1fr);
		gap: 0;
	}

	.layer-item {
		cursor: pointer;
		padding: 14px 12px;
	}

	.layer-item:hover {
		opacity: 0.92;
	}

	.map-panel {
		margin-top: 0;
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
