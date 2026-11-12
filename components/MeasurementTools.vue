<template>
	<view class="measurement-tools">
		<view class="measurement-buttons">
			<button
				class="measurement-button"
				:class="{ active: mode === 'distance' }"
				@click="emit('start', 'distance')"
			>
				{{ mode === 'distance' ? '退出测距' : '多点测距' }}
			</button>
			<button
				class="measurement-button"
				:class="{ active: mode === 'area' }"
				@click="emit('start', 'area')"
			>
				{{ mode === 'area' ? '退出绘制' : '面积测量' }}
			</button>
			<button
				class="measurement-button"
				:class="{ active: mode === 'circle' }"
				@click="emit('start', 'circle')"
			>
				{{ mode === 'circle' ? '退出圆形测量' : '圆形测量' }}
			</button>
			<button
				v-if="measurements.length"
				class="measurement-button measurement-clear"
				@click="emit('clear')"
			>
				清除
			</button>
		</view>
		<text v-if="mode" class="measurement-hint">
			{{ mode === 'distance'
				? '左键依次添加节点，左键双击完成测距'
				: mode === 'circle'
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
				<text class="measurement-result-remove" @click="emit('remove', item.id)">×</text>
			</view>
		</view>
	</view>
</template>

<script setup>
defineProps({
	mode: { type: String, default: '' },
	measurements: { type: Array, required: true },
	formatDistance: { type: Function, required: true },
	formatArea: { type: Function, required: true },
	formatMeasurement: { type: Function, required: true }
})
const emit = defineEmits(['start', 'clear', 'remove'])
</script>

<style>
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
</style>
