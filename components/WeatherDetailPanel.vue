<template>
	<view
		v-if="visible"
		class="weather-detail-panel"
		:class="{ 'weather-detail-panel-forecast': mode === 'future' }"
		@click.stop
	>
		<view class="weather-panel-header">
			<view class="weather-panel-heading">
				<text class="weather-panel-source">数据来源：腾讯位置服务天气查询</text>
				<text class="weather-panel-title">{{ mode === 'now' ? '实时天气' : '预报天气' }}</text>
				<text v-if="weather" class="weather-panel-location">{{ formatWeatherLocation(weather.location) }}</text>
				<text class="weather-panel-location">{{ coordinateLabel }}</text>
			</view>
			<view class="weather-panel-close" @click="emit('close')">×</view>
		</view>
		<view v-if="loading" class="weather-panel-message">正在加载天气信息…</view>
		<view v-else-if="error" class="weather-panel-message weather-panel-error">
			{{ error }}
		</view>
		<view v-else-if="weather">
			<template v-if="mode === 'now'">
				<view class="weather-current">
					<text class="weather-current-icon">{{ getWeatherSymbol(weather.current.weather) }}</text>
					<text class="weather-temperature">
						{{ formatWeatherNumber(weather.current.temperatureC, 0, '°C') || '—' }}
					</text>
					<view class="weather-current-summary">
						<text class="weather-description">{{ weather.current.weather }}</text>
						<text class="weather-current-extra">更新时间 {{ weather.updatedAt || '—' }}</text>
					</view>
				</view>
				<view class="weather-summary-grid">
					<view
						v-for="item in weatherSummaryStats"
						:key="item.label"
						class="weather-summary-card"
					>
						<text class="weather-summary-label">{{ item.label }}</text>
						<text class="weather-summary-value">{{ item.value }}</text>
					</view>
				</view>
				<view v-if="weather.alarms.length" class="weather-alarm-list">
					<view
						v-for="alarm in weather.alarms"
						:key="alarm.title"
						class="weather-alarm"
					>
						<text class="weather-alarm-title">{{ alarm.title || alarm.type }}</text>
						<text class="weather-alarm-content">{{ alarm.content }}</text>
					</view>
				</view>
			</template>
			<template v-else>
				<view class="weather-section-heading weather-forecast-heading">
					<text class="weather-section-title">未来 7 天</text>
					<text class="weather-section-note">每日天气预报</text>
				</view>
				<scroll-view v-if="weatherDailyForecast.length" scroll-x class="weather-forecast-scroll">
					<view class="weather-forecast-table">
						<view class="weather-forecast-table-row weather-forecast-table-header">
							<text>日期</text>
							<text>白天天气</text>
							<text>白天温度</text>
							<text>白天风力</text>
							<text>夜间天气</text>
							<text>夜间温度</text>
							<text>夜间风力</text>
						</view>
						<view
							v-for="day in weatherDailyForecast"
							:key="day.date"
							class="weather-forecast-table-row"
						>
							<view class="weather-forecast-date">
								<text class="weather-daily-day">{{ day.weekday || '—' }}</text>
								<text class="weather-daily-date-value">{{ day.date || '—' }}</text>
							</view>
							<view class="weather-table-weather">
								<text>{{ getWeatherSymbol(day.day.weather) }}</text>
								<text>{{ day.day.weather || '—' }}</text>
							</view>
							<text>{{ formatWeatherNumber(day.day.temperatureC, 0, '°C') || '—' }}</text>
							<text>{{ day.day.windDirection }} {{ day.day.windPower }}</text>
							<view class="weather-table-weather">
								<text>{{ getWeatherSymbol(day.night.weather) }}</text>
								<text>{{ day.night.weather || '—' }}</text>
							</view>
							<text>{{ formatWeatherNumber(day.night.temperatureC, 0, '°C') || '—' }}</text>
							<text>{{ day.night.windDirection }} {{ day.night.windPower }}</text>
						</view>
					</view>
				</scroll-view>
				<text v-else class="weather-panel-message">暂无逐日天气预报</text>
				<view v-if="weatherForecastIndexes.length" class="weather-index-section">
					<text class="weather-section-title">重点生活指数</text>
					<view class="weather-index-grid">
						<view
							v-for="item in weatherForecastIndexes"
							:key="`${item.date}-${item.name}`"
							class="weather-index-card"
						>
							<text class="weather-index-name">{{ item.name }}</text>
							<text class="weather-index-level">{{ item.level }}</text>
							<text class="weather-index-description">{{ item.description }}</text>
						</view>
					</view>
				</view>
			</template>
			<view class="weather-location-section">
				<text class="weather-location-coordinate">
					位置　{{ formatWeatherLocation(weather.location) || coordinateLabel }}
				</text>
				<text class="weather-location-timezone">
					坐标　{{ coordinateLabel }} · 预报更新时间 {{ weather.updatedAt || '—' }}
				</text>
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
	mode: { type: String, default: 'now' },
	weather: { type: Object, default: null },
	coordinateLabel: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const weatherSummaryStats = computed(() => {
	const weather = props.weather
	if (!weather || props.mode !== 'now' || !weather.current) {
		return []
	}

	return [
		{ label: '湿度', value: formatWeatherNumber(weather.current.humidityPercent, 0, '%') },
		{ label: '气压', value: formatWeatherNumber(weather.current.pressureHpa, 0, 'hPa') },
		{ label: '风向', value: weather.current.windDirection || null },
		{ label: '风力', value: weather.current.windPower || null }
	].filter((item) => item.value !== null)
})
const weatherDailyForecast = computed(() => (
	props.mode === 'future' && props.weather ? props.weather.days || [] : []
))
const weatherForecastIndexes = computed(() => {
	const indexes = weatherDailyForecast.value.find((day) => (day.indexes || []).length)?.indexes || []
	const preferredNames = ['雨伞指数', '穿衣指数', '紫外线强度指数', '运动指数', '感冒指数', '洗车指数']
	const preferred = indexes.filter((item) => preferredNames.includes(item.name))
	return (preferred.length ? preferred : indexes).slice(0, 6)
})

function formatWeatherNumber(value, decimals, unit) {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return null
	}
	const formatted = value.toFixed(decimals)
	if (!unit) {
		return formatted
	}
	const spacer = unit === '%' || unit.startsWith('°') ? '' : ' '
	return `${formatted}${spacer}${unit}`
}

function formatWeatherLocation(location) {
	if (!location || typeof location !== 'object') {
		return ''
	}
	return [location.province, location.city, location.district]
		.filter((part) => typeof part === 'string' && part !== '')
		.join(' ')
}

function getWeatherSymbol(description) {
	if (typeof description !== 'string') {
		return '☁'
	}
	if (description.includes('雷')) {
		return '⚡'
	}
	if (description.includes('雨')) {
		return '☂'
	}
	if (description.includes('雪')) {
		return '❄'
	}
	if (description.includes('晴')) {
		return '☀'
	}
	if (description.includes('雾') || description.includes('霾')) {
		return '≋'
	}
	return '☁'
}
</script>

<style>
.weather-detail-panel {
	position: absolute;
	z-index: 8;
	top: 42%;
	right: 12px;
	box-sizing: border-box;
	width: min(920px, calc(100% - 24px));
	max-height: calc(100% - 24px);
	overflow-y: auto;
	padding: 18px;
	transform: translateY(-50%);
	border: 1px solid rgba(24, 49, 83, 0.14);
	border-radius: 16px;
	background: rgba(255, 255, 255, 0.98);
	box-shadow: 0 12px 32px rgba(24, 49, 83, 0.24);
	backdrop-filter: blur(12px);
}

.weather-panel-header {
	position: sticky;
	top: -18px;
	z-index: 2;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	margin: -18px -18px 0;
	padding: 18px 18px 12px;
	border-bottom: 1px solid #e8edf2;
	background: rgba(255, 255, 255, 0.98);
}

.weather-panel-heading {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.weather-panel-source {
	font-size: 11px;
	color: #829ab1;
}

.weather-panel-title {
	font-size: 16px;
	font-weight: 700;
	color: #243b53;
}

.weather-panel-location {
	overflow-wrap: anywhere;
	font-size: 12px;
	color: #627d98;
}

.weather-panel-close {
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

.weather-panel-close:hover {
	background: #e8edf2;
	color: #243b53;
}

.weather-panel-message {
	padding: 28px 4px;
	font-size: 13px;
	color: #52606d;
}

.weather-panel-error {
	color: #b42318;
}

.weather-current {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	padding: 14px 0;
	border-bottom: 1px solid #e8edf2;
}

.weather-current-icon {
	flex: none;
	width: 58px;
	font-size: 46px;
	text-align: center;
}

.weather-temperature {
	font-size: 36px;
	font-weight: 700;
	line-height: 1;
	color: #202b38;
}

.weather-current-summary {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 4px;
	min-width: 180px;
}

.weather-description {
	font-size: 15px;
	font-weight: 600;
	color: #243b53;
}

.weather-current-extra {
	font-size: 11px;
	color: #627d98;
}

.weather-summary-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 10px;
	margin-top: 12px;
}

.weather-summary-card {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	padding: 11px 12px;
	border-radius: 10px;
	background: #f7f9fb;
}

.weather-summary-label {
	font-size: 11px;
	color: #627d98;
}

.weather-summary-value {
	overflow-wrap: anywhere;
	font-size: 14px;
	font-weight: 700;
	color: #243b53;
}

.weather-section-heading {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 9px;
}

.weather-section-title {
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.02em;
	color: #52606d;
}

.weather-section-note {
	font-size: 10px;
	color: #829ab1;
}

.weather-forecast-heading {
	margin: 14px 0 9px;
}

.weather-forecast-scroll {
	width: 100%;
	overflow-x: auto;
	border: 1px solid #e8edf2;
	border-radius: 10px;
}

.weather-forecast-table {
	min-width: 652px;
}

.weather-forecast-table-row {
	display: grid;
	grid-template-columns: 100px 100px 76px 100px 100px 76px 100px;
	align-items: center;
	min-height: 42px;
	border-bottom: 1px solid #edf1f5;
	color: #52606d;
	font-size: 10px;
}

.weather-forecast-table-row:last-child {
	border-bottom: 0;
}

.weather-forecast-table-row > * {
	box-sizing: border-box;
	min-width: 0;
	padding: 5px 7px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.weather-forecast-table-header {
	min-height: 36px;
	background: #f2f6fa;
	color: #627d98;
	font-size: 10px;
	font-weight: 700;
}

.weather-forecast-date {
	display: flex;
	flex-direction: column;
	gap: 3px;
}

.weather-table-weather {
	display: flex;
	align-items: center;
	gap: 5px;
}

.weather-table-weather > :first-child {
	flex: none;
	font-size: 15px;
}

.weather-table-weather > :last-child {
	overflow: hidden;
	text-overflow: ellipsis;
}

.weather-daily-day {
	font-size: 12px;
	font-weight: 700;
	color: #243b53;
}

.weather-daily-date-value {
	font-size: 10px;
	color: #829ab1;
}

.weather-alarm-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 12px;
}

.weather-alarm {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 10px;
	border-left: 3px solid #d92d20;
	border-radius: 7px;
	background: #fff4f2;
}

.weather-alarm-title {
	font-size: 12px;
	font-weight: 700;
	color: #b42318;
}

.weather-alarm-content {
	font-size: 11px;
	line-height: 1.5;
	color: #7a271a;
}

.weather-index-section {
	margin-top: 14px;
	padding-top: 12px;
	border-top: 1px solid #e8edf2;
}

.weather-index-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 7px;
	margin-top: 8px;
}

.weather-index-card {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 9px;
	border-radius: 8px;
	background: #f7f9fb;
}

.weather-index-name {
	font-size: 11px;
	font-weight: 700;
	color: #243b53;
}

.weather-index-level {
	font-size: 10px;
	color: #1677ff;
}

.weather-index-description {
	font-size: 10px;
	line-height: 1.45;
	color: #627d98;
	overflow-wrap: anywhere;
}

.weather-location-section {
	display: flex;
	flex-direction: column;
	gap: 6px;
	margin-top: 14px;
	padding-top: 11px;
	border-top: 1px solid #e8edf2;
}

.weather-location-coordinate,
.weather-location-timezone {
	font-size: 10px;
	color: #829ab1;
	overflow-wrap: anywhere;
}

@media screen and (max-width: 560px) {
	.weather-detail-panel {
		right: 8px;
		width: calc(100% - 16px);
		max-height: calc(100% - 16px);
		padding: 12px;
	}

	.weather-detail-panel-forecast {
		top: 50%;
		transform: translateY(-50%);
	}

	.weather-panel-header {
		top: -12px;
		margin: -12px -12px 0;
		padding: 12px 12px 10px;
	}

	.weather-summary-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.weather-current-summary {
		min-width: 140px;
	}
}

@media screen and (min-width: 768px) and (hover: hover) and (pointer: fine) {
	.weather-detail-panel {
		top: 12px;
		bottom: auto;
		max-height: calc(100% - 220px);
		transform: none;
	}
}
</style>
