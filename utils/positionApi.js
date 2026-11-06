const adminBaseUrl = 'https://oladmin.cc'

export const positionApiBaseUrl = adminBaseUrl
export const loginUrl = `${adminBaseUrl}/login`
export const registerUrl = `${adminBaseUrl}/register`

export function roundCoord(value, digits = 6) {
	return Number(value.toFixed(digits))
}

export function buildFormBody(data) {
	return Object.keys(data)
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
		.join('&')
}

export function resolveAppUrl(path) {
	if (!path || /^https?:\/\//i.test(path)) {
		return path
	}

	if (typeof window === 'undefined') {
		return path
	}

	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return new URL(normalizedPath, window.location.origin).toString()
}

export function getSubmitPositionUrl() {
	return `${positionApiBaseUrl}/admin/position/insert`
}

export function getPositionHistoryUrl(start, end) {
	return `${positionApiBaseUrl}/admin/position/history?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
}

export function getPlaceSearchUrl(keyword) {
	const parameters = new URLSearchParams({ keyword })
	return `${positionApiBaseUrl}/admin/position/query?${parameters.toString()}`
}

export function getRoutePlannerUrl(from, to, mode) {
	const parameters = new URLSearchParams({ from, to, mode })
	return `${positionApiBaseUrl}/admin/position/route?${parameters.toString()}`
}

export function getReverseGeocodeUrl(latitude, longitude) {
	const parameters = new URLSearchParams({
		lat: String(latitude),
		lng: String(longitude)
	})
	return `${positionApiBaseUrl}/admin/position/reverse?${parameters.toString()}`
}

export function request(options) {
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
