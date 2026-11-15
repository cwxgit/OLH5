import { ref } from 'vue'
import { wgs84ToGcj02 } from '../utils/coordTransform'
import {
	buildFormBody,
	getSubmitPositionUrl,
	request,
	roundCoord
} from '../utils/positionApi'

export function useLocation({
	markerSourceWgs84,
	userLocationWgs84,
	currentAccuracy,
	hasLocated,
	locating,
	locationLabel,
	viewRef,
	geoZoom,
	setMapCenterByWgs84,
	renderMarker,
	onLocationSuccess
}) {
	const trackingEnabled = ref(false)
	let geolocationWatchId = null
	let historySubmissionPending = false

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
			if (result && typeof result === 'object' && result.warning) {
				console.warn('位置坐标已记录，但部分地址信息不可用', result.warning)
			}
		} catch (error) {
			console.warn('定位信息上报失败', error)
			disableLocationTracking()
			uni.showToast({ title: error && error.message ? error.message : '位置记录失败', icon: 'none' })
		} finally {
			historySubmissionPending = false
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
		setMapCenterByWgs84(wgs84, keepCurrentZoom && viewRef.value ? viewRef.value.getZoom() : geoZoom)
		renderMarker()
		if (typeof onLocationSuccess === 'function') {
			void onLocationSuccess(wgs84)
		}
		if (trackingEnabled.value) {
			await submitUserPosition(wgs84)
		}
	}

	function startLocationTracking() {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			return false
		}

		if (geolocationWatchId !== null) {
			return true
		}

		geolocationWatchId = navigator.geolocation.watchPosition(
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

	function startPositionTracking() {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			uni.showToast({ title: '当前环境不支持定位', icon: 'none' })
			return
		}
		trackingEnabled.value = true
		if (!startLocationTracking()) {
			trackingEnabled.value = false
			uni.showToast({ title: '无法启动持续定位', icon: 'none' })
			return
		}
	}

	function disableLocationTracking() {
		trackingEnabled.value = false
		if (typeof navigator !== 'undefined' && navigator.geolocation && geolocationWatchId !== null) {
			navigator.geolocation.clearWatch(geolocationWatchId)
			geolocationWatchId = null
		}
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

		setMapCenterByWgs84(userLocationWgs84.value, geoZoom)
		renderMarker()
	}

	return {
		trackingEnabled,
		startPositionTracking,
		disableLocationTracking,
		locateMe,
		recenterToUser
	}
}
