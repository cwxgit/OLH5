```vue
<template>
	<view v-if="visible" class="aqi-panel" @click.stop>
		<view class="aqi-panel-header">
			<view class="aqi-panel-heading">
				<text class="aqi-panel-source">数据来源：世界空气质量指数 (aqicn.org)</text>
				<text class="aqi-panel-title">空气质量</text>
				<text class="aqi-panel-location">{{ displayStationName }}</text>
				<text class="aqi-panel-location">{{ coordinateLabel }}</text>
			</view>
			<view class="aqi-panel-close" @click="emit('close')">×</view>
		</view>

		<view v-if="loading" class="aqi-panel-message">正在加载空气质量信息…</view>
		<view v-else-if="error" class="aqi-panel-message aqi-panel-error">{{ error }}</view>
		<view v-else-if="airQuality">
			<view class="aqi-hero" :style="{ borderLeftColor: levelColor }">
				<view class="aqi-hero-value">
					<text class="aqi-hero-number" :style="{ color: levelColor }">{{ displayAqi }}</text>
					<text class="aqi-hero-unit">AQI</text>
				</view>
				<view class="aqi-hero-meta">
					<text class="aqi-hero-level" :style="{ background: levelColor }">{{ displayLevelLabel }}</text>
					<text class="aqi-hero-primary">{{ primaryText }}</text>
					<text class="aqi-hero-advice">{{ adviceText }}</text>
				</view>
			</view>

			<view v-if="pollutants.length" class="aqi-section">
				<view class="aqi-section-heading">
					<text class="aqi-section-title">污染物分指数</text>
					<text class="aqi-section-note">{{ standardNote }}</text>
				</view>
				<view class="aqi-pollutant-list">
					<view v-for="item in pollutants" :key="item.key" class="aqi-pollutant">
						<view class="aqi-pollutant-head">
							<text class="aqi-pollutant-name">{{ item.label }}</text>
							<text class="aqi-pollutant-value">{{ item.aqi }}</text>
						</view>
						<view class="aqi-pollutant-track">
							<view
								class="aqi-pollutant-bar"
								:style="{ width: `${barWidth(item.aqi)}%`, background: item.levelColor }"
							></view>
						</view>
						<text class="aqi-pollutant-desc">{{ item.name }} · {{ item.levelLabel }}</text>
					</view>
				</view>
			</view>
			<view v-else class="aqi-panel-message">该站点未提供分污染物数据</view>

			<view class="aqi-footer">
				<text class="aqi-footer-line">站点　{{ displayStationName }}{{ stationRegion ? ' / ' + stationRegion : '' }}</text>
				<text class="aqi-footer-line">距离　{{ distanceText }}</text>
				<text class="aqi-footer-line">更新　{{ displayUpdatedAt }}</text>
				<a
					v-if="stationUrl"
					class="aqi-footer-link"
					:href="stationUrl"
					target="_blank"
					rel="noopener noreferrer"
				>
					查看该站点详情
				</a>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	visible: { type: Boolean, default: false },
	loading: { type: Boolean, default: false },
	error: { type: String, default: '' },
	airQuality: { type: Object, default: null },
	coordinateLabel: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const AQI_BAR_MAX = 300

const pollutants = computed(() => (props.airQuality ? props.airQuality.pollutants || [] : []))
const displayAqi = computed(() => {
	const value = props.airQuality ? props.airQuality.aqi : null
	return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
})
const levelColor = computed(() => (props.airQuality?.level?.color) || '#829ab1')
const displayLevelLabel = computed(() => {
	const level = props.airQuality?.level
	if (!level) {
		return '暂无等级'
	}
	return level.labelEn ? `${level.label}（${level.labelEn}）` : level.label
})
const adviceText = computed(() => props.airQuality?.level?.advice || '暂无健康提示')
const primaryText = computed(() => {
	const primary = props.airQuality?.primary
	if (!primary) {
		return '首要污染物：暂无'
	}
	return `首要污染物：${primary.label}（AQI ${primary.aqi}）`
})
const standardNote = computed(() => {
	const standard = props.airQuality?.standard
	return standard ? `${standard} 分级 · 数值为各污染物 AQI 分指数` : '数值为各污染物 AQI 分指数'
})
const displayStationName = computed(() => props.airQuality?.station?.name || '未知监测站点')
const stationRegion = computed(() => {
	const country = props.airQuality?.station?.country
	return typeof country === 'string' ? country.toUpperCase() : ''
})
const stationUrl = computed(() => {
	const url = props.airQuality?.station?.url
	return typeof url === 'string' && url.startsWith('http') ? url : ''
})
const distanceText = computed(() => {
	const distance = props.airQuality?.station?.distanceKm
	if (typeof distance !== 'number' || !Number.isFinite(distance)) {
		return '未知'
	}
	return distance < 1
		? `${Math.round(distance * 1000)} 米（最近监测站到查询点）`
		: `${distance.toFixed(1)} 公里（最近监测站到查询点）`
})
const displayUpdatedAt = computed(() => {
	const value = props.airQuality?.updatedAt
	if (typeof value !== 'string' || value === '') {
		return '未知'
	}
	return value.replace('T', ' ')
})

function barWidth(value) {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		return 2
	}
	return Math.max(2, Math.min(100, (value / AQI_BAR_MAX) * 100))
}
</script>

<style>
.aqi-panel {
	position: absolute;
	z-index: 8;
	top: 12px;
	right: 12px;
	box-sizing: border-box;
	width: min(420px, calc(100% - 24px));
	max-height: calc(100% - 24px);
	overflow-y: auto;
	padding: 16px;
	border: 1px solid rgba(24, 49, 83, 0.14);
	border-radius: 16px;
	background: rgba(255, 255, 255, 0.98);
	box-shadow: 0 12px 32px rgba(24, 49, 83, 0.24);
	backdrop-filter: blur(12px);
}

.aqi-panel-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	margin: -16px -16px 0;
	padding: 16px 16px 12px;
	border-bottom: 1px solid #e8edf2;
	background: rgba(255, 255, 255, 0.98);
}

.aqi-panel-heading {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.aqi-panel-source {
	font-size: 11px;
	color: #829ab1;
}

.aqi-panel-title {
	font-size: 16px;
	font-weight: 700;
	color: #243b53;
}

.aqi-panel-location {
	overflow-wrap: anywhere;
	font-size: 12px;
	color: #627d98;
}

.aqi-panel-close {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border-radius: 8px;
	color: #52606d;
	font-size: 23px;
	line-height: 1;
	cursor: pointer;
}

.aqi-panel-close:hover {
	background: #e8edf2;
	color: #243b53;
}

.aqi-panel-message {
	padding: 24px 4px;
	font-size: 13px;
	color: #52606d;
}

.aqi-panel-error {
	color: #b42318;
}

.aqi-hero {
	display: flex;
	align-items: center;
	gap: 14px;
	margin-top: 14px;
	padding: 12px 14px;
	border-left: 4px solid #829ab1;
	border-radius: 10px;
	background: #f7f9fb;
}

.aqi-hero-value {
	display: flex;
	flex: none;
	flex-direction: column;
	align-items: center;
	min-width: 74px;
}

.aqi-hero-number {
	font-size: 38px;
	font-weight: 700;
	line-height: 1.05;
}

.aqi-hero-unit {
	font-size: 11px;
	color: #829ab1;
}

.aqi-hero-meta {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 5px;
	min-width: 0;
}

.aqi-hero-level {
	align-self: flex-start;
	padding: 3px 9px;
	border-radius: 999px;
	color: #ffffff;
	font-size: 12px;
	font-weight: 700;
}

.aqi-hero-primary {
	font-size: 12px;
	font-weight: 600;
	color: #243b53;
}

.aqi-hero-advice {
	font-size: 11px;
	line-height: 1.5;
	color: #627d98;
}

.aqi-section {
	margin-top: 14px;
	padding-top: 12px;
	border-top: 1px solid #e8edf2;
}

.aqi-section-heading {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 9px;
}

.aqi-section-title {
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.02em;
	color: #52606d;
}

.aqi-section-note {
	font-size: 10px;
	color: #829ab1;
}

.aqi-pollutant-list {
	display: flex;
	flex-direction: column;
	gap: 9px;
}

.aqi-pollutant {
	display: flex;
	flex-direction: column;
	gap: 3px;
}

.aqi-pollutant-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
}

.aqi-pollutant-name {
	font-size: 12px;
	font-weight: 600;
	color: #243b53;
}

.aqi-pollutant-value {
	font-size: 13px;
	font-weight: 700;
	color: #243b53;
}

.aqi-pollutant-track {
	height: 6px;
	border-radius: 999px;
	background: #eef2f6;
	overflow: hidden;
}

.aqi-pollutant-bar {
	height: 100%;
	border-radius: 999px;
	transition: width 0.2s ease;
}

.aqi-pollutant-desc {
	font-size: 10px;
	color: #829ab1;
}

.aqi-footer {
	display: flex;
	flex-direction: column;
	gap: 5px;
	margin-top: 14px;
	padding-top: 11px;
	border-top: 1px solid #e8edf2;
}

.aqi-footer-line {
	font-size: 10px;
	line-height: 1.5;
	color: #829ab1;
	overflow-wrap: anywhere;
}

.aqi-footer-link {
	font-size: 11px;
	color: #1677ff;
	text-decoration: underline;
}

@media screen and (max-width: 560px) {
	.aqi-panel {
		top: 8px;
		right: 8px;
		width: calc(100% - 16px);
		max-height: calc(100% - 16px);
		padding: 12px;
	}

	.aqi-panel-header {
		margin: -12px -12px 0;
		padding: 12px 12px 10px;
	}

	.aqi-hero-number {
		font-size: 32px;
	}
}
</style>