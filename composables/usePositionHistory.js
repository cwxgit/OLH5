import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import { Fill, Stroke, Style, Text, Circle as CircleStyle } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { getDistance } from 'ol/sphere'
import { gcj02ToWgs84 } from '../utils/coordTransform'
import { getPositionHistoryUrl, request } from '../utils/positionApi'

export function usePositionHistory({
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
}) {
	let playbackTimer = null
	let historyPlaybackFeature = null

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
				.map((record, index, records) => {
					if (index === 0) {
						return { ...record, speedKmh: null }
					}
					const previousRecord = records[index - 1]
					const elapsedSeconds = (
						Date.parse(record.datetime.replace(' ', 'T'))
						- Date.parse(previousRecord.datetime.replace(' ', 'T'))
					) / 1000
					const speedKmh = elapsedSeconds > 0
						? getDistance(previousRecord.coordinate, record.coordinate) / elapsedSeconds * 3.6
						: null
					return { ...record, speedKmh: Number.isFinite(speedKmh) ? speedKmh : null }
				})
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
				text: formatHistoryPlaybackLabel(historyRecords.value[0]),
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
		historyPlaybackFeature.getStyle().getText().setText(formatHistoryPlaybackLabel(record))
		if (recenter && viewRef.value) {
			viewRef.value.animate({ center: coordinate, duration: 250 })
		}
	}

	function formatHistoryPlaybackLabel(record) {
		const speed = record.speedKmh === null ? '--' : `${record.speedKmh.toFixed(1)} km/h`
		return `${record.datetime}\n速度：${speed}`
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

	return {
		handleHistoryDateChange,
		handleHistoryTimeChange,
		loadPositionHistory,
		renderPositionHistory,
		seekHistoryPlayback,
		toggleHistoryPlayback,
		stopHistoryPlayback
	}
}
