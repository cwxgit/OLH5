import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import OSM from 'ol/source/OSM'

const RAINVIEWER_METADATA_URL = 'https://api.rainviewer.com/public/weather-maps.json'
const RAINVIEWER_TILE_HOST = 'https://tilecache.rainviewer.com'
const RAINVIEWER_MAX_ZOOM = 7

export function buildBaseLayers() {
	const tengxun = new TileLayer({
		source: new XYZ({
			url: 'https://rt0.map.gtimg.com/realtimerender?z={z}&x={x}&y={-y}&type=vector&style=0'
		}),
		visible: true
	})
	tengxun.set('role', 'base')
	tengxun.set('layerKey', 'tengxun')

	const osm = new TileLayer({ source: new OSM(), visible: false })
	osm.set('role', 'base')
	osm.set('layerKey', 'osm')

	const google = new TileLayer({
		source: new XYZ({
			url: 'https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&s=Ga'
		}),
		visible: false
	})
	google.set('role', 'base')
	google.set('layerKey', 'google')

	const gaode = new TileLayer({
		source: new XYZ({
			url: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
		}),
		visible: false
	})
	gaode.set('role', 'base')
	gaode.set('layerKey', 'gaode')

	const arcgis = new TileLayer({
		source: new XYZ({
			url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
		}),
		visible: false
	})
	arcgis.set('role', 'base')
	arcgis.set('layerKey', 'arcgis')

	const nasa = new TileLayer({
		source: new XYZ({
			url: 'https://v.cpxiang.tech/tiles/{z}/{x}/{y}.webp',
			crossOrigin: 'anonymous',
			maxZoom: 8
		}),
		visible: false
	})
	nasa.set('role', 'base')
	nasa.set('layerKey', 'nasa')

	return [tengxun, osm, google, gaode, arcgis, nasa]
}

export function buildRainViewerLayers() {
	const layer = new TileLayer({
		source: new XYZ({
			url: `${RAINVIEWER_TILE_HOST}/v2/radar/placeholder/256/{z}/{x}/{y}/2/1_1.png`,
			crossOrigin: 'anonymous',
			maxZoom: RAINVIEWER_MAX_ZOOM,
			attributions: '<a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">Weather data by RainViewer</a>'
		}),
		opacity: 0.85,
		visible: false
	})
	layer.set('role', 'weather')
	layer.set('weatherKey', 'radar')
	return [layer]
}

export async function refreshRainViewerLayer(layer) {
	const response = await fetch(RAINVIEWER_METADATA_URL, { cache: 'no-cache' })
	if (!response.ok) {
		throw new Error(`RainViewer metadata request returned HTTP ${response.status}`)
	}

	const metadata = await response.json()
	const latestFrame = metadata?.radar?.past?.at(-1)
	if (metadata?.host !== RAINVIEWER_TILE_HOST
		|| !latestFrame
		|| typeof latestFrame.path !== 'string'
		|| !/^\/v2\/radar\/[A-Za-z0-9_-]+$/.test(latestFrame.path)) {
		throw new Error('RainViewer metadata did not contain a valid latest radar frame')
	}

	const source = layer.getSource()
	const tileUrl = `${metadata.host}${latestFrame.path}/256/{z}/{x}/{y}/2/1_1.png`
	const urls = source.getUrls()
	if (!urls || urls[0] !== tileUrl) {
		source.setUrl(tileUrl)
	}
}
