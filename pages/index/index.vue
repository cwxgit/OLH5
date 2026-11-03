<template>
	<view class="page-shell">
		<view class="workspace-layout" :class="{ 'sidebar-collapsed': !sidebarVisible }">
			<view class="sidebar-panel">
				<button class="sidebar-toggle" @click="toggleSidebar">隐藏控制栏</button>
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

						<view class="place-search">
							<input
								class="place-search-input"
								type="text"
								:value="areaSearchKeyword"
								placeholder="搜索地名或行政区"
								confirm-type="search"
								@input="handleAreaSearchInput"
								@confirm="searchAreasNow"
							/>
							<view v-if="areaSearchLoading || areaSearchError || areaSearchResults.length || (areaSearchHasSearched && !areaSearchLoading)" class="place-search-results">
								<text v-if="areaSearchLoading" class="place-search-message">正在搜索...</text>
								<text v-else-if="areaSearchError" class="place-search-message place-search-error">{{ areaSearchError }}</text>
								<template v-else-if="areaSearchResults.length">
									<view
										v-for="result in areaSearchResults"
										:key="result.code"
										class="place-search-result"
										@click="selectSearchResult(result)"
									>
										<text class="place-search-name">{{ result.name }}</text>
										<text class="place-search-meta">{{ areaLabel(Number(result.level) - 1) }} · {{ result.lng }},{{ result.lat }}</text>
									</view>
								</template>
								<text v-else class="place-search-message">没有找到匹配地点</text>
							</view>
						</view>

						<view class="history-card">
							<text class="history-title">位置历史与轨迹回放</text>
							<text class="history-policy">
								登录后可授权记录坐标和时间；每次至少间隔 30 秒且移动不少于 50 米。记录还包含请求 IP、设备信息和地址解析结果；仅本人可查看，撤回授权不会删除已有记录。
							</text>
							<checkbox-group @change="handleHistoryConsentChange">
								<label class="history-consent">
									<checkbox value="consent" :checked="historyConsentChecked" color="#0f766e" />
									<text>我同意记录并保存本次使用期间的位置</text>
								</label>
							</checkbox-group>
							<view class="history-actions">
								<button
									v-if="!trackingEnabled"
									class="history-button"
									:disabled="!historyConsentChecked"
									@click="enableLocationTracking"
								>
									同意并开始记录
								</button>
								<button v-else class="history-button history-stop-button" @click="disableLocationTracking">
									停止并撤回授权
								</button>
							</view>
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

			<view class="map-panel">
				<button v-if="!sidebarVisible" class="sidebar-toggle sidebar-toggle-floating" @click="toggleSidebar">显示控制栏</button>
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
import Draw from 'ol/interaction/Draw'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'
import CircleGeom from 'ol/geom/Circle'
import { defaults as defaultControls, ScaleLine } from 'ol/control'
import { primaryAction } from 'ol/events/condition'
import { Fill, Stroke, Style, Text, Circle as CircleStyle } from 'ol/style'
import { fromLonLat, toLonLat } from 'ol/proj'
import { getArea, getDistance, getLength, offset } from 'ol/sphere'
import { ROOT_AREAS } from '../../utils/areas'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../../utils/coordTransform'

const DEFAULT_CENTER = [116.405285, 39.904989]
const DEFAULT_CENTER_ZOOM = 8
const GEO_ZOOM = 16
const AREA_ZOOMS = [6, 10, 14, 16, 18]
const baseUrl = 'https://layers.cpxiang.tech/'
const adminBaseUrl = 'https://oladmin.cc'
const positionApiBaseUrl = adminBaseUrl
const loginUrl = adminBaseUrl + '/login'
const registerUrl = adminBaseUrl + '/register'

const mapRef = ref(null)
const viewRef = ref(null)
const measurementSourceRef = ref(null)
const historySourceRef = ref(null)
const sidebarVisible = ref(true)
const positionFeatureRef = ref(null)
const accuracyFeatureRef = ref(null)
const geolocationWatchId = ref(null)
const areaSearchKeyword = ref('')
const areaSearchResults = ref([])
const areaSearchLoading = ref(false)
const areaSearchHasSearched = ref(false)
const areaSearchError = ref('')
let areaSearchTimer = null
let areaSearchRequestId = 0
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
const historyConsentChecked = ref(false)
const trackingEnabled = ref(false)
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
let measurementDrawInteraction = null
let nextMeasurementId = 1
let playbackTimer = null
let historyPlaybackFeature = null
let historySubmissionPending = false
let lastHistorySample = null
let positionConsentRequestId = 0

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
	renderPositionHistory(false)
}

function mapCoordinateTree(coordinates, transform) {
	if (!Array.isArray(coordinates)) {
		return coordinates
	}
	if (typeof coordinates[0] === 'number') {
		return transform(coordinates)
	}
	return coordinates.map((coordinate) => mapCoordinateTree(coordinate, transform))
}

function createMeasurementGeometry(type, coordinates) {
	return type === 'distance'
		? new LineString(coordinates)
		: new Polygon(coordinates)
}

function renderMeasurements() {
	if (!measurementSourceRef.value) {
		return
	}
	const coordType = getLayerConfig().coordType
	measurements.value.forEach((measurement) => {
		const feature = measurementSourceRef.value.getFeatures().find(
			(item) => item.get('measurementId') === measurement.id
		)
		if (!feature) {
			return
		}
		const coordinates = mapCoordinateTree(measurement.coordinates, (coordinate) => {
			return fromLonLat(encodeByCoordType(coordinate, coordType))
		})
		feature.setGeometry(createMeasurementGeometry(measurement.type, coordinates))
	})
}

function createCircleCoordinates(center, radius) {
	const segments = 96
	const ring = []
	for (let index = 0; index <= segments; index += 1) {
		ring.push(offset(center, radius, (index / segments) * Math.PI * 2))
	}
	return [ring]
}

function stopMeasurement() {
	if (measurementDrawInteraction) {
		const interaction = measurementDrawInteraction
		measurementDrawInteraction = null
		interaction.setActive(false)
		interaction.abortDrawing()
		interaction.getOverlay().getSource().clear()
		if (mapRef.value) {
			mapRef.value.removeInteraction(interaction)
		}
	}
	measurementMode.value = ''
	measurementInProgress.value = false
}

function startMeasurement(type) {
	if (!mapRef.value || !measurementSourceRef.value) {
		uni.showToast({ title: '地图尚未准备好，请稍后重试', icon: 'none' })
		return
	}
	if (measurementMode.value === type) {
		stopMeasurement()
		return
	}
	stopMeasurement()
	measurementMode.value = type
	measurementDrawInteraction = new Draw({
		source: measurementSourceRef.value,
		type: type === 'area' ? 'Polygon' : 'LineString',
		condition: primaryAction,
		geometryFunction: type === 'circle'
			? (coordinates, geometry) => {
				const center = coordinates[0]
				const edge = coordinates[coordinates.length - 1]
				const radius = Math.hypot(edge[0] - center[0], edge[1] - center[1])
				if (geometry) {
					geometry.setCenterAndRadius(center, radius)
					return geometry
				}
				return new CircleGeom(center, radius)
			}
			: undefined
	})
	measurementDrawInteraction.on('drawstart', () => {
		measurementInProgress.value = true
	})
	measurementDrawInteraction.on('drawabort', () => {
		measurementInProgress.value = false
	})
	let measurementCompleted = false
	measurementDrawInteraction.on('drawend', (event) => {
		if (measurementCompleted) {
			return
		}
		measurementCompleted = true
		measurementInProgress.value = false
		const coordType = getLayerConfig().coordType
		const id = nextMeasurementId++
		let coordinates
		let measurement
		if (type === 'circle') {
			const circle = event.feature.getGeometry()
			const center3857 = circle.getCenter()
			const center = decodeByCoordType(toLonLat(center3857), coordType)
			const edge = decodeByCoordType(
				toLonLat([center3857[0] + circle.getRadius(), center3857[1]]),
				coordType
			)
			const radius = getDistance(center, edge)
			coordinates = createCircleCoordinates(center, radius)
			measurement = {
				id,
				type,
				coordinates,
				perimeter: 2 * Math.PI * radius,
				area: Math.PI * radius * radius
			}
		} else {
			const geographicGeometry = event.feature.getGeometry().clone().transform('EPSG:3857', 'EPSG:4326')
			coordinates = mapCoordinateTree(geographicGeometry.getCoordinates(), (coordinate) => {
				return decodeByCoordType(coordinate, coordType)
			})
			const geometryWgs84 = createMeasurementGeometry(type, coordinates)
			measurement = { id, type, coordinates }
			if (type === 'distance') {
				measurement.distance = getLength(geometryWgs84, { projection: 'EPSG:4326' })
			} else {
				measurement.area = getArea(geometryWgs84, { projection: 'EPSG:4326' })
			}
		}
		measurements.value.push(measurement)

		event.feature.set('measurementId', id)
		event.feature.setStyle(new Style({
			fill: new Fill({ color: 'rgba(255, 183, 3, 0.18)' }),
			stroke: new Stroke({ color: '#f08c00', width: 3 }),
			image: new CircleStyle({
				radius: 5,
				fill: new Fill({ color: '#f08c00' }),
				stroke: new Stroke({ color: '#ffffff', width: 2 })
			}),
			text: new Text({
				text: formatMeasurement(measurement),
				font: '600 13px sans-serif',
				fill: new Fill({ color: '#183153' }),
				backgroundFill: new Fill({ color: 'rgba(255, 255, 255, 0.9)' }),
				padding: [4, 6, 4, 6],
				overflow: true
			})
		}))
		event.feature.setGeometry(createMeasurementGeometry(
			type,
			mapCoordinateTree(coordinates, (coordinate) => {
				return fromLonLat(encodeByCoordType(coordinate, coordType))
			})
		))
		stopMeasurement()
	})
	mapRef.value.addInteraction(measurementDrawInteraction)
}

function formatMeasurement(measurement) {
	if (measurement.type === 'distance') {
		return formatDistance(measurement.distance)
	}
	if (measurement.type === 'circle') {
		return `周长 ${formatDistance(measurement.perimeter)} / 面积 ${formatArea(measurement.area)}`
	}
	return formatArea(measurement.area)
}

function formatDistance(distance) {
	return distance < 1000
		? `${distance.toFixed(1)} 米`
		: `${(distance / 1000).toFixed(3)} 千米`
}

function formatArea(area) {
	return area < 1000000
		? `${area.toFixed(1)} 平方米`
		: `${(area / 1000000).toFixed(3)} 平方千米`
}

function removeMeasurement(id) {
	const feature = measurementSourceRef.value && measurementSourceRef.value.getFeatures().find(
		(item) => item.get('measurementId') === id
	)
	if (feature) {
		measurementSourceRef.value.removeFeature(feature)
	}
	measurements.value = measurements.value.filter((item) => item.id !== id)
}

function clearMeasurements() {
	stopMeasurement()
	if (measurementSourceRef.value) {
		measurementSourceRef.value.clear(true)
	}
	measurements.value = []
}

function toggleSidebar() {
	sidebarVisible.value = !sidebarVisible.value
	nextTick(() => {
		requestAnimationFrame(() => mapRef.value && mapRef.value.updateSize())
	})
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
	const path = `/admin/position/nextarea?pid=${encodeURIComponent(String(parentCode))}`
	return `${positionApiBaseUrl}${path}`
}

function getAreaSearchUrl(keyword) {
	return `${positionApiBaseUrl}/admin/position/query?keyword=${encodeURIComponent(keyword)}`
}

function getSubmitPositionUrl() {
	return `${positionApiBaseUrl}/admin/position/insert`
}

function getPositionHistoryUrl(start, end) {
	return `${positionApiBaseUrl}/admin/position/history?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
}

function getPositionConsentUrl() {
	return `${positionApiBaseUrl}/admin/position/consent`
}

function request(options) {
	return new Promise((resolve, reject) => {
		uni.request({
			...options,
			url: resolveAppUrl(options.url),
			withCredentials: true,
			success: (response) => {
				if (response.statusCode < 200 || response.statusCode >= 300) {
					const data = response.data
					const message = data && typeof data === 'object' && data.message
						? data.message
						: `请求失败（HTTP ${response.statusCode}）`
					reject(new Error(message))
					return
				}
				resolve(response)
			},
			fail: reject
		})
	})
}

async function updatePositionConsent(action) {
	const response = await request({
		url: getPositionConsentUrl(),
		method: 'POST',
		header: { 'content-type': 'application/x-www-form-urlencoded' },
		data: buildFormBody({ action })
	})
	const payload = response && typeof response === 'object' && 'data' in response
		? response.data
		: null
	if (!payload || payload.success !== true) {
		throw new Error(payload && payload.message ? payload.message : '位置授权操作失败')
	}
}

function handleHistoryConsentChange(event) {
	const consented = event.detail.value.includes('consent')
	if (!consented && trackingEnabled.value) {
		disableLocationTracking()
		return
	}
	historyConsentChecked.value = consented
}

function handleHistoryDateChange(boundary, event) {
	const date = String(event.detail.value || '')
	if (boundary === 'start') {
		historyStartDate.value = date
		return
	}
	historyEndDate.value = date
}

function handleHistoryTimeChange(boundary, event) {
	const time = String(event.detail.value || '')
	if (boundary === 'start') {
		historyStartTime.value = time
		return
	}
	historyEndTime.value = time
}

async function enableLocationTracking() {
	if (!historyConsentChecked.value) {
		return
	}
	if (typeof navigator === 'undefined' || !navigator.geolocation) {
		uni.showToast({ title: '当前环境不支持定位', icon: 'none' })
		return
	}
	const requestId = ++positionConsentRequestId
	try {
		await updatePositionConsent('grant')
		if (requestId !== positionConsentRequestId || !historyConsentChecked.value) {
			await updatePositionConsent('revoke')
			return
		}
		trackingEnabled.value = true
		startLocationTracking()
		locateMe()
	} catch (error) {
		historyConsentChecked.value = false
		uni.showToast({ title: error && error.message ? error.message : '请登录后授权记录位置', icon: 'none' })
	}
}

async function disableLocationTracking(showError = true) {
	const wasTracking = trackingEnabled.value
	positionConsentRequestId += 1
	trackingEnabled.value = false
	historyConsentChecked.value = false
	if (typeof navigator !== 'undefined' && navigator.geolocation && geolocationWatchId.value !== null) {
		navigator.geolocation.clearWatch(geolocationWatchId.value)
		geolocationWatchId.value = null
	}
	if (!wasTracking) {
		return
	}
	try {
		await updatePositionConsent('revoke')
	} catch (error) {
		if (showError) {
			uni.showToast({ title: '本机已停止记录，但服务器撤回授权失败', icon: 'none' })
		} else {
			console.warn('撤回位置记录授权失败', error)
		}
	}
}

async function loadPositionHistory() {
	const start = `${historyStartDate.value} ${historyStartTime.value}`
	const end = `${historyEndDate.value} ${historyEndTime.value}`
	if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(start)
		|| !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(end)
		|| start > end) {
		historyError.value = '请选择有效的开始和结束日期时间'
		return
	}
	historyLoading.value = true
	historyLoaded.value = false
	historyError.value = ''
	stopHistoryPlayback()
	try {
		const response = await request({
			url: getPositionHistoryUrl(start, end),
			method: 'GET'
		})
		const payload = response && typeof response === 'object' && 'data' in response
			? response.data
			: null
		if (!payload || payload.success !== true || !Array.isArray(payload.items)) {
			throw new Error(payload && payload.message ? payload.message : '轨迹数据格式无效')
		}
		historyRecords.value = payload.items
			.filter((item) => item && typeof item.position === 'string' && typeof item.datetime === 'string')
			.map((item) => {
				const parts = item.position.split(',').map((part) => Number(part.trim()))
				if (parts.length !== 2 || !parts.every(Number.isFinite)) {
					return null
				}
				return {
					id: item.id,
					datetime: item.datetime,
					coordinate: gcj02ToWgs84(parts[0], parts[1])
				}
			})
			.filter(Boolean)
		historyPlaybackIndex.value = 0
		historyLoaded.value = true
		renderPositionHistory()
		if (payload.truncated) {
			historyError.value = '记录较多，仅显示最早的 5000 个位置点'
		}
	} catch (error) {
		historyRecords.value = []
		if (historySourceRef.value) {
			historySourceRef.value.clear(true)
		}
		historyError.value = error && error.message ? error.message : '轨迹加载失败'
	} finally {
		historyLoading.value = false
	}
}

function renderPositionHistory(fitMap = true) {
	if (!historySourceRef.value) {
		return
	}
	historySourceRef.value.clear(true)
	historyPlaybackFeature = null
	if (!historyRecords.value.length) {
		return
	}

	const coordType = getLayerConfig().coordType
	const mapCoordinate = (coordinate) => fromLonLat(encodeByCoordType(coordinate, coordType))
	const coordinates = historyRecords.value.map((record) => mapCoordinate(record.coordinate))

	if (coordinates.length > 1) {
		const line = new Feature(new LineString(coordinates))
		line.setStyle(new Style({
			stroke: new Stroke({ color: '#1677ff', width: 4 })
		}))
		historySourceRef.value.addFeature(line)
	}

	const pointStyle = new Style({
		image: new CircleStyle({
			radius: 4,
			fill: new Fill({ color: '#ffffff' }),
			stroke: new Stroke({ color: '#1677ff', width: 2 })
		})
	})
	coordinates.forEach((coordinate) => {
		const point = new Feature(new Point(coordinate))
		point.setStyle(pointStyle)
		historySourceRef.value.addFeature(point)
	})

	historyPlaybackFeature = new Feature(new Point(coordinates[0]))
	historyPlaybackFeature.setStyle(new Style({
		image: new CircleStyle({
			radius: 8,
			fill: new Fill({ color: '#e5484d' }),
			stroke: new Stroke({ color: '#ffffff', width: 3 })
		}),
		text: new Text({
			text: historyRecords.value[0].datetime,
			offsetY: -18,
			font: '600 12px sans-serif',
			fill: new Fill({ color: '#183153' }),
			backgroundFill: new Fill({ color: 'rgba(255,255,255,0.9)' }),
			padding: [3, 5, 3, 5]
		})
	}))
	historySourceRef.value.addFeature(historyPlaybackFeature)
	setHistoryPlaybackIndex(historyPlaybackIndex.value)
	if (fitMap && coordinates.length > 1) {
		mapRef.value.getView().fit(new LineString(coordinates).getExtent(), {
			padding: [60, 60, 60, 60],
			maxZoom: 16,
			duration: 300
		})
	}
}

function setHistoryPlaybackIndex(value, recenter = false) {
	if (!historyRecords.value.length) {
		return
	}
	const index = Math.max(0, Math.min(historyRecords.value.length - 1, Math.round(Number(value) || 0)))
	historyPlaybackIndex.value = index
	const record = historyRecords.value[index]
	if (!record || !historyPlaybackFeature) {
		return
	}
	const coordType = getLayerConfig().coordType
	const coordinate = fromLonLat(encodeByCoordType(record.coordinate, coordType))
	historyPlaybackFeature.getGeometry().setCoordinates(coordinate)
	historyPlaybackFeature.getStyle().getText().setText(record.datetime)
	if (recenter && viewRef.value) {
		viewRef.value.animate({ center: coordinate, duration: 250 })
	}
}

function seekHistoryPlayback(event) {
	stopHistoryPlayback()
	setHistoryPlaybackIndex(event.detail.value, true)
}

function toggleHistoryPlayback() {
	if (historyPlaying.value) {
		stopHistoryPlayback()
		return
	}
	if (historyRecords.value.length < 2) {
		return
	}
	if (historyPlaybackIndex.value >= historyRecords.value.length - 1) {
		setHistoryPlaybackIndex(0, true)
	}
	historyPlaying.value = true
	playbackTimer = setInterval(() => {
		const nextIndex = historyPlaybackIndex.value + 1
		if (nextIndex >= historyRecords.value.length) {
			stopHistoryPlayback()
			return
		}
		setHistoryPlaybackIndex(nextIndex, true)
	}, 1000)
}

function stopHistoryPlayback() {
	if (playbackTimer !== null) {
		clearInterval(playbackTimer)
		playbackTimer = null
	}
	historyPlaying.value = false
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
	if (!trackingEnabled.value || historySubmissionPending) {
		return
	}
	const sampleTime = Date.now()
	if (lastHistorySample) {
		const elapsed = sampleTime - lastHistorySample.time
		const distance = getDistance(lastHistorySample.coordinate, wgs84)
		if (elapsed < 30000 || distance < 50) {
			return
		}
	}

	const gcj02 = wgs84ToGcj02(wgs84[0], wgs84[1])
	const positionText = `${roundCoord(gcj02[0])},${roundCoord(gcj02[1])}`

	historySubmissionPending = true
	try {
		const response = await request({
			url: getSubmitPositionUrl(),
			method: 'POST',
			header: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			data: buildFormBody({
				position: positionText,
				useragent: getUserAgentText()
			})
		})
		const result = response && typeof response === 'object' && 'data' in response
			? response.data
			: null
		if (!result || result.success !== true) {
			throw new Error(result && result.message ? result.message : '位置记录失败')
		}
		if (result && typeof result === 'object' && result.sampled === false) {
			lastHistorySample = { coordinate: wgs84, time: sampleTime }
			return
		}
		if (result && typeof result === 'object' && result.warning) {
			console.warn('位置已记录，但 IP 归属地暂不可用', result.warning)
		}
		lastHistorySample = { coordinate: wgs84, time: sampleTime }
	} catch (error) {
		console.warn('定位信息上报失败', error)
		disableLocationTracking()
		uni.showToast({ title: error && error.message ? error.message : '位置记录失败', icon: 'none' })
	} finally {
		historySubmissionPending = false
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

function handleAreaSearchInput(event) {
	areaSearchKeyword.value = String(event && event.detail ? event.detail.value : '')
	areaSearchResults.value = []
	areaSearchError.value = ''
	areaSearchHasSearched.value = false
	areaSearchRequestId += 1
	areaSearchLoading.value = false

	if (areaSearchTimer) {
		clearTimeout(areaSearchTimer)
		areaSearchTimer = null
	}

	const keyword = areaSearchKeyword.value.trim()
	if (!keyword) {
		return
	}

	const requestId = areaSearchRequestId
	areaSearchTimer = setTimeout(() => {
		areaSearchTimer = null
		void searchAreas(keyword, requestId)
	}, 300)
}

function searchAreasNow() {
	if (areaSearchTimer) {
		clearTimeout(areaSearchTimer)
		areaSearchTimer = null
	}
	areaSearchRequestId += 1
	void searchAreas(areaSearchKeyword.value.trim(), areaSearchRequestId)
}

async function searchAreas(keyword, requestId) {
	if (!keyword) {
		areaSearchResults.value = []
		areaSearchHasSearched.value = false
		areaSearchError.value = ''
		areaSearchLoading.value = false
		return
	}

	areaSearchLoading.value = true
	areaSearchHasSearched.value = true
	areaSearchError.value = ''
	try {
		const response = await request({
			url: getAreaSearchUrl(keyword),
			method: 'GET'
		})
		const rawPayload = response && typeof response === 'object' && 'data' in response
			? response.data
			: response
		const payload = typeof rawPayload === 'string'
			? parseAreaPayload(rawPayload)
			: rawPayload
		if (!Array.isArray(payload)) {
			throw new Error('地点查询接口返回格式无效')
		}

		if (requestId !== areaSearchRequestId) {
			return
		}
		areaSearchResults.value = payload
			.filter((item) => item && item.code && item.name)
			.map((item) => ({
				...item,
				code: String(item.code),
				level: Number(item.level),
				position: [Number(item.lng), Number(item.lat)]
			}))
			.filter((item) => Number.isFinite(item.position[0]) && Number.isFinite(item.position[1]))
	} catch (error) {
		if (requestId !== areaSearchRequestId) {
			return
		}
		console.warn('查询行政区失败', error)
		areaSearchError.value = error && error.message ? error.message : '地点查询失败，请稍后重试'
		areaSearchResults.value = []
	} finally {
		if (requestId === areaSearchRequestId) {
			areaSearchLoading.value = false
		}
	}
}

function selectSearchResult(result) {
	panToArea(result.position, result.level, 'gcj02')
	areaSearchKeyword.value = result.name
	areaSearchResults.value = []
	areaSearchHasSearched.value = false
	areaSearchError.value = ''
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
	if (trackingEnabled.value) {
		await submitUserPosition(wgs84)
	}
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

	const measurementSource = new VectorSource()
	const measurementLayer = new VectorLayer({ source: measurementSource })
	measurementLayer.set('role', 'measurement')
	const historySource = new VectorSource()
	const historyLayer = new VectorLayer({ source: historySource })
	historyLayer.set('role', 'history')

	positionFeatureRef.value = positionFeature
	accuracyFeatureRef.value = accuracyFeature
	measurementSourceRef.value = measurementSource
	historySourceRef.value = historySource
	markerSourceWgs84.value = null

	viewRef.value = new View({
		center: fromLonLat(center),
		zoom: DEFAULT_CENTER_ZOOM,
		maxZoom: 18,
		minZoom: 3
	})

	mapRef.value = new Map({
		target: 'ol-map',
		layers: buildBaseLayers().concat(overlayLayer, historyLayer, measurementLayer),
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
	}

onMounted(() => {
	initMap()
})

onBeforeUnmount(() => {
	if (areaSearchTimer) {
		clearTimeout(areaSearchTimer)
		areaSearchTimer = null
	}
	areaSearchRequestId += 1
	disableLocationTracking(false)
	stopHistoryPlayback()
	stopMeasurement()
	if (mapRef.value) {
		mapRef.value.setTarget(undefined)
	}
	positionFeatureRef.value = null
	accuracyFeatureRef.value = null
	measurementSourceRef.value = null
	historySourceRef.value = null
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
	display: none;
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

.place-search {
	position: relative;
	z-index: 2;
	margin-top: 18rpx;
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

.place-search-results {
	margin-top: 8rpx;
	border: 2rpx solid rgba(36, 59, 83, 0.08);
	border-radius: 16rpx;
	background: #fffdfa;
	box-shadow: 0 10rpx 24rpx rgba(36, 59, 83, 0.08);
	overflow: hidden;
}

.place-search-result {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	padding: 18rpx 20rpx;
	border-bottom: 1rpx solid rgba(36, 59, 83, 0.08);
}

.place-search-result:last-child {
	border-bottom: 0;
}

.place-search-name {
	font-size: 26rpx;
	font-weight: 600;
	color: #243b53;
}

.place-search-meta,
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

.history-consent {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin-top: 12rpx;
	font-size: 22rpx;
	line-height: 1.5;
	color: #243b53;
}

.history-consent checkbox {
	transform: scale(0.8);
}

.history-actions,
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

.select-grid {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
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
	top: 12px;
	left: 12px;
	width: auto;
}

.map-canvas {
	width: 100%;
	height: 100%;
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
	grid-template-columns: minmax(0, 1fr);
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
	}

	.hero-panel {
		padding: 24px;
	}

	.select-grid {
		grid-template-columns: minmax(0, 1fr);
	}

	.map-panel {
		height: auto;
		min-height: 580px;
		grid-column: auto;
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
