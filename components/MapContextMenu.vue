<template>
	<view
		v-if="visible"
		class="route-context-menu"
		:style="{ left: `${left}px`, top: `${top}px` }"
		@click.stop
	>
		<text class="route-context-title">当前位置</text>
		<text class="route-context-coordinate">{{ coordinateLabel }}</text>
		<view class="route-context-action" @click="emit('select-endpoint', 'origin')">设为起点</view>
		<view class="route-context-action" @click="emit('select-endpoint', 'destination')">设为终点</view>
		<view class="route-context-action" @click="emit('show-current-weather')">实时天气</view>
		<view class="route-context-action" @click="emit('show-forecast-weather')">预报天气</view>
		<view class="route-context-action" @click="emit('show-aqi')">空气质量指数</view>
	</view>
</template>

<script setup>
defineProps({
	visible: { type: Boolean, default: false },
	left: { type: Number, default: 0 },
	top: { type: Number, default: 0 },
	coordinateLabel: { type: String, default: '' }
})
const emit = defineEmits(['select-endpoint', 'show-current-weather', 'show-forecast-weather', 'show-aqi'])
</script>

<style>
.route-context-menu {
	position: absolute;
	z-index: 10;
	box-sizing: border-box;
	width: 160px;
	padding: 4px;
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
	padding: 4px 8px;
	border-radius: 6px;
	color: #243b53;
	font-size: 13px;
	cursor: pointer;
}

.route-context-action:hover {
	background: rgba(22, 119, 255, 0.1);
	color: #1677ff;
}
</style>
