<template>
	<view class="page-shell">
		<view class="hero-panel">
			<view class="hero-copy">
				<text class="eyebrow">OLH5 / Vue3 + OpenLayers</text>
				<text class="hero-title">移动端地图浏览与行政区联动</text>
				<text class="hero-desc">
					复刻 `layers.cpxiang.tech` 的核心能力，保留原有后端接口调用路径，并针对 H5 场景优化布局与交互。
				</text>
			</view>

			<view class="hero-actions">
				<button class="geo-button" @click="locateMe">{{ geoButtonText }}</button>
				<button v-if="hasLocated" class="ghost-button" @click="recenterToUser">回到我的位置</button>
			</view>

			<view class="status-strip">
				<text class="status-pill">图层：{{ activeLayerLabel }}</text>
				<text class="status-pill">坐标：{{ activeCoordLabel }}</text>
				<text v-if="locationLabel" class="status-pill success-pill">{{ locationLabel }}</text>
			</view>

			<view class="toolbar-card">
				<view class="toolbar-head">
					<text class="toolbar-title">地址联动</text>
					<view class="link-actions">
						<text class="link-action" @click="openLink(loginUrl)">登录</text>
						<text class="link-action" @click="openLink(registerUrl)">注册</text>
					</view>
				</view>

				<view class="select-grid">
					<picker
						v-for="(group, index) in areaGroups"
						:key="group.key"
						:range="group.options"
						range-key="name"
						:value="getPickerIndex(group)"
						@change="handleAreaChange(index, $event)"
					>
						<view class="select-card">
							<text class="select-label">{{ areaLabel(index) }}</text>
							<text class="select-value">{{ getPickerLabel(group) }}</text>
						</view>
					</picker>
				</view>
			</view>
		</view>

		<view class="map-panel">
			<view id="ol-map" class="map-canvas"></view>
		</view>

		<view class="layer-panel">
			<view class="layer-panel-head">
				<text class="layer-title">底图切换</text>
				<text class="layer-subtitle">与 PC 站点保持一致</text>
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
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import 'ol/ol.css'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import CircleGeom from 'ol/geom/Circle'
import { defaults as defaultControls, ScaleLine } from 'ol/control'
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style'
import { fromLonLat, toLonLat } from 'ol/proj'
import { ROOT_AREAS } from '../../utils/areas'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../../utils/coordTransform'

const DEFAULT_CENTER = [116.405285, 39.904989]
const DEFAULT_CENTER_ZOOM = 8
const GEO_ZOOM = 16
const AREA_ZOOMS = [6, 10, 14, 16, 18]
const baseUrl = 'https://layers.cpxiang.tech/'
const loginUrl = baseUrl + 'index.php?admin=1&dir=users&php=login&sub=2'
const registerUrl = baseUrl + 'index.php?admin=1&dir=users&php=reg&sub=2'

const mapRef = ref(null)
const viewRef = ref(null)
const positionFeatureRef = ref(null)
const accuracyFeatureRef = ref(null)
const geolocationWatchId = ref(null)
const lastSubmittedPosition = ref('')
const markerSourceWgs84 = ref(null)
const userLocationWgs84 = ref(null)
const currentAccuracy = ref(0)
const hasLocated = ref(false)
const locating = ref(false)
const locationLabel = ref('')
const activeLayerKey = ref('tengxun')
const eesDisabledHint = ref(false)

const areaGroups = ref([
	{
		key: 'level-1',
		selectedCode: '0',
		options: [{ code: '0', name: '--请选择省份--', status: 0 }].concat(
			ROOT_AREAS.map((item) => ({
				...item,
				coordType: 'gcj02'
			}))
		)
	}
])

const layerConfigs = reactive([
	{ key: 'tengxun', label: 'Tengxun', coordType: 'gcj02', coordLabel: 'gcj02', note: '', disabled: false },
	{ key: 'osm', label: 'OSM', coordType: 'wgs84', coordLabel: 'wgs84', note: '需翻墙', disabled: false },
	{ key: 'google', label: 'Google Satellites', coordType: 'wgs84', coordLabel: 'wgs84', note: '需翻墙', disabled: false },
	{ key: 'gaode', label: 'Gaode Maps', coordType: 'gcj02', coordLabel: 'gcj02', note: '', disabled: false },
	{ key: 'arcgis', label: 'Arc Maps', coordType: 'wgs84', coordLabel: 'wgs84', note: '', disabled: false },
	{ key: 'nasa', label: 'NASA Viirs', coordType: 'wgs84', coordLabel: 'wgs84', note: '', disabled: false }
])

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

function areaLabel(index) {
	const labels = ['省份', '地市', '区县', '乡镇', '村组']
	return labels[index] || `层级 ${index + 1}`
}

function getPickerIndex(group) {
	const index = group.options.findIndex((item) => item.code === group.selectedCode)
	return index < 0 ? 0 : index
}

function getPickerLabel(group) {
	const current = group.options.find((item) => item.code === group.selectedCode)
	return current ? current.name : group.options[0].name
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

	const centerWgs84 = getMapCenterInWgs84()
	activeLayerKey.value = key
	setLayerVisible(key)
	setMapCenterByWgs84(centerWgs84)
	renderMarker()
}

function roundCoord(value, digits = 6) {
	return Number(value.toFixed(digits))
}

function buildFormBody(data) {
	return Object.keys(data)
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
		.join('&')
}

function resolveAppUrl(path) {
	if (!path || /^https?:\/\//i.test(path)) {
		return path
	}

	if (typeof window === 'undefined') {
		return path
	}

	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return new URL(normalizedPath, window.location.origin).toString()
}

function getNextAreaRequestUrl(parentCode) {
	const query = `admin=0&dir=first&php=nextarea&pid=${parentCode}`
	if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
		return `/index.php?${query}`
	}
	return `${baseUrl}index.php?${query}`
}

function getSubmitPositionUrl() {
	const query = 'admin=0&dir=first&php=ajax'
	if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
		return `/index.php?${query}`
	}
	return `${baseUrl}index.php?${query}`
}

function request(options) {
	return new Promise((resolve, reject) => {
		uni.request({
			...options,
			url: resolveAppUrl(options.url),
			success: resolve,
			fail: reject
		})
	})
}

function getUserAgentText() {
	if (typeof navigator === 'undefined') {
		return 'unknown'
	}

	const ua = navigator.userAgent
	const result = []
	if (/Trident/i.test(ua)) result.push('IE')
	if (/Win64|Win32/i.test(ua)) result.push('windows平台')
	if (/Presto/i.test(ua)) result.push('Opera')
	if (/AppleWebKit/i.test(ua)) result.push('WebKit')
	if (/Gecko/i.test(ua) && !/KHTML/i.test(ua)) result.push('Firefox')
	if (/Mobile/i.test(ua)) result.push('移动端')
	if (/iPhone/i.test(ua)) result.push('iPhone or QQHD')
	if (/iPad/i.test(ua)) result.push('iPad')
	if (/MicroMessenger/i.test(ua)) result.push('微信')
	if (/\sQQ/i.test(ua)) result.push('QQ')
	if (/Android|Adr/i.test(ua)) result.push('Android')
	if (/CPU.+Mac OS X/i.test(ua)) result.push('IOS')
	return result.join(',') || ua
}

async function submitUserPosition(wgs84) {
	const gcj02 = wgs84ToGcj02(wgs84[0], wgs84[1])
	const positionText = `${roundCoord(gcj02[0])},${roundCoord(gcj02[1])}`
	if (lastSubmittedPosition.value === positionText) {
		return
	}

	try {
		await request({
			url: getSubmitPositionUrl(),
			method: 'POST',
				header: {
				'content-type': 'application/x-www-form-urlencoded',
				'X-Requested-With': 'XMLHttpRequest'
			},
			data: buildFormBody({
				position: positionText,
				useragent: getUserAgentText()
			})
		})
		lastSubmittedPosition.value = positionText
	} catch (error) {
		console.warn('定位信息上报失败', error)
	}
}

async function loadNextAreas(parentCode, groupIndex) {
	try {
		const response = await request({
			url: getNextAreaRequestUrl(parentCode),
			method: 'GET'
		})
		console.log("loadNextAreas:",response)
		const rawPayload = response && typeof response === 'object' && 'data' in response
			? response.data
			: response
		const payload = typeof rawPayload === 'string'
			? parseAreaPayload(rawPayload)
			: rawPayload

		if (!Array.isArray(payload) || !payload.length) {
			return
		}

		const parentOption = areaGroups.value[groupIndex].options.find((item) => item.code === parentCode)
		const nextOptions = payload
			.filter((item) => item && item.code && item.name)
			.map((item) => ({
				code: String(item.code),
				name: String(item.name),
				status: 1,
				level: Number(item.level || groupIndex + 2),
				pcode: String(item.pcode || parentCode),
				category: String(item.category || '0'),
				coordType: 'gcj02',
				position: [parseFloat(item.lng), parseFloat(item.lat)]
			}))
			.filter((item) => Number.isFinite(item.position[0]) && Number.isFinite(item.position[1]))

		if (!nextOptions.length) {
			return
		}

		areaGroups.value.push({
			key: `level-${groupIndex + 2}`,
			selectedCode: '0',
			options: [{ code: '0', name: '--上一级--', status: 0, level: parentOption ? parentOption.level : groupIndex + 1 }].concat(nextOptions)
		})
		if (parentOption && parentOption.position) {
			panToArea(parentOption.position, parentOption.level, parentOption.coordType)
		}
	} catch (error) {
		console.warn('加载下级行政区失败', error)
		const isLocalDev = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
		uni.showToast({
			title: isLocalDev ? '本地调试接口失败，请检查代理' : (error && error.message ? error.message : '行政区加载失败'),
			icon: 'none'
		})
	}
}

function parseAreaPayload(rawText) {
	const text = String(rawText || '').trim()
	if (!text) {
		return []
	}

	if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
		throw new Error('接口返回了 HTML，请检查请求路径或代理配置')
	}

	return JSON.parse(text)
}

function panToArea(position, level, coordType = 'gcj02') {
	if (!Array.isArray(position) || position.length < 2) {
		return
	}

	const sourceCoord = [Number(position[0]), Number(position[1])]
	markerSourceWgs84.value = coordType === 'gcj02'
		? gcj02ToWgs84(sourceCoord[0], sourceCoord[1])
		: sourceCoord
	setMapCenterByWgs84(markerSourceWgs84.value, AREA_ZOOMS[Math.max(0, Math.min((level || 1) - 1, AREA_ZOOMS.length - 1))])
	renderMarker()
}

async function handleAreaChange(groupIndex, event) {
	const targetGroup = areaGroups.value[groupIndex]
	const option = targetGroup.options[event.detail.value]
	if (!option) {
		return
	}

	targetGroup.selectedCode = option.code
	areaGroups.value = areaGroups.value.slice(0, groupIndex + 1)
	if (option.position) {
		panToArea(option.position, option.level, option.coordType)
	}

	if (option.status === 1) {
		await loadNextAreas(option.code, groupIndex)
	}
}

async function handleGeolocationSuccess(position, keepCurrentZoom = false) {
	locating.value = false
	const wgs84 = [position.coords.longitude, position.coords.latitude]
	markerSourceWgs84.value = wgs84
	userLocationWgs84.value = wgs84
	currentAccuracy.value = position.coords.accuracy || 0
	hasLocated.value = true
	locationLabel.value = `定位成功 ${roundCoord(wgs84[0], 4)}, ${roundCoord(wgs84[1], 4)}`
	setMapCenterByWgs84(wgs84, keepCurrentZoom && viewRef.value ? viewRef.value.getZoom() : GEO_ZOOM)
	renderMarker()
	await submitUserPosition(wgs84)
}

function startLocationTracking() {
	if (typeof navigator === 'undefined' || !navigator.geolocation) {
		return false
	}

	if (geolocationWatchId.value !== null) {
		return true
	}

	geolocationWatchId.value = navigator.geolocation.watchPosition(
		async (position) => {
			await handleGeolocationSuccess(position, true)
		},
		(error) => {
			console.warn('持续定位失败', error)
		},
		{
			enableHighAccuracy: true,
			timeout: 12000,
			maximumAge: 0
		}
	)

	return true
}

function locateMe() {
	if (typeof navigator === 'undefined' || !navigator.geolocation || locating.value) {
		uni.showToast({ title: '当前环境不支持定位', icon: 'none' })
		return
	}

	startLocationTracking()
	locating.value = true
	navigator.geolocation.getCurrentPosition(
		async (position) => {
			await handleGeolocationSuccess(position)
		},
		(error) => {
			locating.value = false
			locationLabel.value = ''
			console.warn('定位失败', error)
			uni.showToast({ title: '定位失败，请检查浏览器权限', icon: 'none' })
		},
		{
			enableHighAccuracy: true,
			timeout: 12000,
			maximumAge: 0
		}
	)
}

function recenterToUser() {
	if (!userLocationWgs84.value) {
		locateMe()
		return
	}

	setMapCenterByWgs84(userLocationWgs84.value, GEO_ZOOM)
	renderMarker()
}

function openLink(url) {
	if (typeof window !== 'undefined') {
		window.open(resolveAppUrl(url), '_blank')
	}
}

function buildBaseLayers() {
	const tengxun = new TileLayer({
		source: new XYZ({
			url: 'https://rt0.map.gtimg.com/realtimerender?z={z}&x={x}&y={-y}&type=vector&style=0'
		}),
		visible: true
	})
	tengxun.set('role', 'base')
	tengxun.set('layerKey', 'tengxun')

	const osm = new TileLayer({ source: new OSM(), visible: false })
	osm.set('role', 'base')
	osm.set('layerKey', 'osm')

	const google = new TileLayer({
		source: new XYZ({
			url: 'https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&s=Ga'
		}),
		visible: false
	})
	google.set('role', 'base')
	google.set('layerKey', 'google')

	const gaode = new TileLayer({
		source: new XYZ({
			url: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
		}),
		visible: false
	})
	gaode.set('role', 'base')
	gaode.set('layerKey', 'gaode')

	const arcgis = new TileLayer({
		source: new XYZ({
			url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
		}),
		visible: false
	})
	arcgis.set('role', 'base')
	arcgis.set('layerKey', 'arcgis')

	const nasa = new TileLayer({
		source: new XYZ({
			url: 'https://v.cpxiang.tech/tiles/{z}/{x}/{y}.webp',
			crossOrigin: 'anonymous',
			maxZoom: 8
		}),
		visible: false
	})
	nasa.set('role', 'base')
	nasa.set('layerKey', 'nasa')

	return [tengxun, osm, google, gaode, arcgis, nasa]
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

	positionFeatureRef.value = positionFeature
	accuracyFeatureRef.value = accuracyFeature
	markerSourceWgs84.value = DEFAULT_CENTER

	viewRef.value = new View({
		center: fromLonLat(center),
		zoom: DEFAULT_CENTER_ZOOM,
		maxZoom: 18,
		minZoom: 3
	})

	mapRef.value = new Map({
		target: 'ol-map',
		layers: buildBaseLayers().concat(overlayLayer),
		view: viewRef.value,
		controls: defaultControls().extend([
			new ScaleLine({ units: 'metric' })
		])
	})

	viewRef.value.on('change:resolution', () => {
		updateLayerAvailability()
	})

	renderMarker()
	updateLayerAvailability()
	locateMe()
	}

onMounted(() => {
	initMap()
})

onBeforeUnmount(() => {
	if (typeof navigator !== 'undefined' && navigator.geolocation && geolocationWatchId.value !== null) {
		navigator.geolocation.clearWatch(geolocationWatchId.value)
		geolocationWatchId.value = null
	}
	if (mapRef.value) {
		mapRef.value.setTarget(undefined)
	}
	positionFeatureRef.value = null
	accuracyFeatureRef.value = null
})
</script>

<style>
.page-shell {
	min-height: 100vh;
	padding: 24rpx 24rpx 32rpx;
	background:
		radial-gradient(circle at top left, rgba(255, 196, 121, 0.28), transparent 30%),
		linear-gradient(180deg, #f7f4ec 0%, #efe7d8 44%, #d8ddd1 100%);
	font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;
	color: #183153;
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

.toolbar-card {
	margin-top: 24rpx;
	padding: 22rpx;
	border-radius: 24rpx;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(247, 244, 236, 0.92));
	border: 2rpx solid rgba(188, 108, 37, 0.12);
}

.toolbar-head {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 16rpx;
	flex-wrap: wrap;
}

.toolbar-title {
	font-size: 30rpx;
	font-weight: 700;
	color: #243b53;
}

.link-actions {
	display: flex;
	gap: 20rpx;
}

.link-action {
	font-size: 26rpx;
	font-weight: 600;
	color: #0f766e;
}

.select-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16rpx;
	margin-top: 18rpx;
}

.select-card {
	padding: 18rpx 20rpx;
	min-height: 112rpx;
	border-radius: 20rpx;
	background: #fffdfa;
	border: 2rpx solid rgba(36, 59, 83, 0.08);
	box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.4);
}

.select-label {
	display: block;
	font-size: 22rpx;
	color: #7b8794;
}

.select-value {
	display: block;
	margin-top: 10rpx;
	font-size: 28rpx;
	line-height: 1.4;
	font-weight: 600;
	color: #243b53;
}

.map-panel {
	position: relative;
	margin-top: 24rpx;
	height: calc(100vh - 700rpx);
	min-height: 780rpx;
	border-radius: 30rpx;
	overflow: hidden;
	box-shadow: 0 24rpx 56rpx rgba(36, 59, 83, 0.18);
	background: #dbe3da;
}

.map-canvas {
	width: 100%;
	height: 100%;
}

.layer-panel {
	margin-top: 24rpx;
	padding: 20rpx;
	border-radius: 24rpx;
	background: rgba(16, 24, 32, 0.82);
	backdrop-filter: blur(10px);
	color: #ffffff;
}

.layer-list {
	display: flex;
	flex-direction: column;
}

.layer-panel-head {
	margin-bottom: 10rpx;
}

.layer-title {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
}

.layer-subtitle {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.72);
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

@media screen and (min-width: 768px) {
	.page-shell {
		padding: 24px;
	}

	.hero-panel {
		padding: 24px;
	}

	.select-grid {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.map-panel {
		height: calc(100vh - 420px);
		min-height: 580px;
	}

	.layer-panel {
		padding: 18px 22px;
	}

	.layer-panel-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 12px;
	}

	.layer-list {
		flex-direction: row;
		flex-wrap: wrap;
		gap: 12px;
	}

	.layer-item {
		flex: 1 1 calc(33.333% - 12px);
		min-width: 180px;
		cursor: pointer;
		padding: 14px 12px;
		border-bottom: 0;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.05);
	}

	.layer-item:hover {
		opacity: 0.92;
	}
	}
</style>
