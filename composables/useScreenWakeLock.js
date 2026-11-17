import { ref, watch } from 'vue'

/**
 * 屏幕常亮（Wake Lock）逻辑：
 * 当 keepScreenAwake 为 true 时尝试持有屏幕锁；为 false 时释放。
 * 页面切到后台再回到前台时会自动重试。
 */
export function useScreenWakeLock({ keepScreenAwake }) {
	const screenWakeLockStatus = ref('持续定位期间会尝试保持屏幕常亮')
	let screenWakeLock = null
	let screenWakeLockRequestId = 0
	let screenWakeLockPending = false

	async function requestScreenWakeLock() {
		if (!keepScreenAwake.value) {
			return
		}
		if (typeof navigator === 'undefined' || !navigator.wakeLock || !navigator.wakeLock.request) {
			screenWakeLockStatus.value = '当前浏览器不支持自动保持屏幕常亮'
			return
		}
		if (screenWakeLock && !screenWakeLock.released) {
			screenWakeLockStatus.value = '屏幕常亮已开启'
			return
		}
		if (screenWakeLockPending) {
			return
		}

		screenWakeLock = null
		const requestId = ++screenWakeLockRequestId
		screenWakeLockPending = true
		try {
			const wakeLock = await navigator.wakeLock.request('screen')
			if (requestId !== screenWakeLockRequestId || !keepScreenAwake.value
				|| (typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
				await wakeLock.release()
				return
			}

			screenWakeLock = wakeLock
			screenWakeLockStatus.value = '屏幕常亮已开启'
			wakeLock.addEventListener('release', () => {
				if (screenWakeLock === wakeLock) {
					screenWakeLock = null
					screenWakeLockStatus.value = keepScreenAwake.value
						? '屏幕常亮已暂停，返回页面后将重试'
						: '屏幕常亮已关闭'
				}
			}, { once: true })
		} catch (error) {
			if (requestId === screenWakeLockRequestId && keepScreenAwake.value) {
				screenWakeLockStatus.value = '无法保持屏幕常亮，请检查浏览器与系统设置'
				console.warn('Screen Wake Lock request failed:', error)
			}
		} finally {
			if (requestId === screenWakeLockRequestId) {
				screenWakeLockPending = false
			}
		}
	}

	function releaseScreenWakeLock() {
		screenWakeLockRequestId += 1
		screenWakeLockPending = false
		const wakeLock = screenWakeLock
		screenWakeLock = null
		screenWakeLockStatus.value = '屏幕常亮已关闭'
		if (wakeLock && !wakeLock.released) {
			wakeLock.release().catch((error) => {
				console.warn('Screen Wake Lock release failed:', error)
			})
		}
	}

	function handleVisibilityChange() {
		if (!keepScreenAwake.value) {
			return
		}
		if (document.visibilityState === 'visible') {
			requestScreenWakeLock()
		} else {
			screenWakeLockStatus.value = '页面切到后台时，浏览器可能暂停屏幕常亮'
		}
	}

	watch(keepScreenAwake, (active) => {
		if (active) {
			requestScreenWakeLock()
		} else {
			releaseScreenWakeLock()
		}
	}, { flush: 'sync', immediate: true })

	return {
		screenWakeLockStatus,
		handleVisibilityChange,
		releaseScreenWakeLock
	}
}
