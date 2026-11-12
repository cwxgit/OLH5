import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import OSM from 'ol/source/OSM'
import { getWeatherTileUrl } from './positionApi'

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

export function buildWeatherLayers() {
	return [
		{ key: 'clouds', opacity: 0.7 },
		{ key: 'radar', opacity: 0.75 },
		{ key: 'rain', opacity: 0.75 }
	].map(({ key, opacity }) => {
		const layer = new TileLayer({
			source: new XYZ({
				url: getWeatherTileUrl(key),
				crossOrigin: 'anonymous',
				maxZoom: 19
			}),
			opacity,
			visible: false
		})
		layer.set('role', 'weather')
		layer.set('weatherKey', key)
		return layer
	})
}
