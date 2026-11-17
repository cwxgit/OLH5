import { reactive } from 'vue'
import { toLonLat } from 'ol/proj'
import { wgs84ToGcj02 } from '../utils/coordTransform'

const MENU_WIDTH = 188
const MENU_HEIGHT = 160

/**
 * 地图右键菜单：维护菜单位置与目标 GCJ-02 坐标，并把"设为起点/终点"委托给上层。
 */
export function useMapContextMenu({
	mapRef,
	mapTargetElement,
	getLayerConfig,
	decodeByCoordType,
	setRouteEndpointFromMap
}) {
	const routeContextMenu = reactive({
		visible: false,
		left: 0,
		top: 0,
		lat: 0,
		lng: 0,
		coordinateLabel: ''
	})

	function handleMapContextMenu(event) {
		if (!mapRef.value || !mapTargetElement.value) {
			return
		}
		event.preventDefault()

		const displayCoordinate = toLonLat(mapRef.value.getEventCoordinate(event))
		const wgs84 = decodeByCoordType(displayCoordinate, getLayerConfig().coordType)
		if (!wgs84) {
			return
		}
		const [longitude, latitude] = wgs84ToGcj02(wgs84[0], wgs84[1])
		const targetRect = mapTargetElement.value.getBoundingClientRect()
		const x = event.clientX - targetRect.left
		const y = event.clientY - targetRect.top

		routeContextMenu.lat = latitude
		routeContextMenu.lng = longitude
		routeContextMenu.coordinateLabel = `${longitude.toFixed(6)}, ${latitude.toFixed(6)}`
		routeContextMenu.left = Math.max(8, Math.min(x, targetRect.width - MENU_WIDTH - 8))
		routeContextMenu.top = Math.max(8, Math.min(y, targetRect.height - MENU_HEIGHT - 8))
		routeContextMenu.visible = true
	}

	function closeRouteContextMenu() {
		routeContextMenu.visible = false
	}

	function handleDocumentPointerDown(event) {
		if (event.target instanceof Element
			&& (event.target.closest('.route-context-menu') || event.target.closest('#ol-map'))) {
			return
		}
		closeRouteContextMenu()
	}

	function setMapRouteEndpoint(endpoint) {
		const selected = setRouteEndpointFromMap(endpoint, {
			lat: routeContextMenu.lat,
			lng: routeContextMenu.lng
		})
		if (selected) {
			closeRouteContextMenu()
		}
	}

	return {
		routeContextMenu,
		handleMapContextMenu,
		closeRouteContextMenu,
		handleDocumentPointerDown,
		setMapRouteEndpoint
	}
}
