<template>
	<view class="layer-panel" :class="{ 'layer-panel-map-overlay': overlay }">
		<view v-if="!overlay" class="layer-panel-head">
			<text class="layer-title">底图切换</text>
		</view>
		<view class="layer-list">
			<view
				v-for="layer in layers"
				:key="layer.key"
				class="layer-item"
				:class="{ disabled: layer.disabled }"
				@click="emit('change-layer', layer.key)"
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
		<view class="layer-list">
			<view
				v-for="layer in weatherLayers"
				:key="layer.key"
				class="layer-item"
				@click="emit('toggle-weather-layer', layer.key)"
			>
				<view class="layer-radio" :class="{ active: weatherLayerEnabled[layer.key] }"></view>
				<view class="layer-meta">
					<text class="layer-name">{{ layer.label }}</text>
					<text class="layer-extra">{{ layer.note }}</text>
				</view>
			</view>
		</view>
		<text v-if="weatherLayerError" class="weather-layer-error">{{ weatherLayerError }}</text>
		<a
			class="weather-layer-credit"
			href="https://www.rainviewer.com/"
			target="_blank"
			rel="noopener noreferrer"
		>
			天气雷达数据：RainViewer
		</a>
	</view>
</template>

<script setup>
defineProps({
	layers: { type: Array, required: true },
	activeLayerKey: { type: String, default: '' },
	weatherLayerEnabled: { type: Object, required: true },
	weatherLayerError: { type: String, default: '' },
	eesDisabledHint: { type: Boolean, default: false },
	overlay: { type: Boolean, default: false }
})
const emit = defineEmits(['change-layer', 'toggle-weather-layer'])

const weatherLayers = [
	{ key: 'radar', label: '雷达降水', note: '近 2 小时回波 · 10 分钟更新' }
]
</script>

<style>
.layer-panel {
	padding: 20rpx;
	border-radius: 24rpx;
	background: rgba(16, 24, 32, 0.82);
	backdrop-filter: blur(10px);
	color: #ffffff;
}

.layer-panel-map-overlay {
	display: none;
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

.weather-layer-error,
.weather-layer-credit {
	display: block;
	margin-top: 12rpx;
	font-size: 20rpx;
	line-height: 1.5;
}

.weather-layer-error {
	color: #ffc2b8;
}

.weather-layer-credit {
	color: rgba(255, 255, 255, 0.8);
	text-decoration: underline;
}

@media screen and (min-width: 768px) and (hover: hover) and (pointer: fine) {
	.layer-panel {
		padding: 18px 22px;
	}

	.layer-panel-map-overlay {
		position: absolute;
		z-index: 5;
		right: 16px;
		bottom: 16px;
		display: block;
		box-sizing: border-box;
		width: min(280px, calc(100% - 32px));
		max-height: calc(100% - 32px);
		overflow-y: auto;
		padding: 14px 18px;
		background: rgba(16, 24, 32, 0.22);
	}

	.layer-panel-map-overlay .layer-list {
		grid-template-columns: repeat(2, minmax(0, 1fr));
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
	}

	.layer-item:hover {
		opacity: 0.85;
	}
}
</style>
