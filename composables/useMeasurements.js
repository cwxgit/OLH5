import Draw from 'ol/interaction/Draw'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'
import CircleGeom from 'ol/geom/Circle'
import { primaryAction } from 'ol/events/condition'
import { Fill, Stroke, Style, Text, Circle as CircleStyle } from 'ol/style'
import { fromLonLat, toLonLat } from 'ol/proj'
import { getArea, getDistance, getLength, offset } from 'ol/sphere'

export function useMeasurements({
	mapRef,
	measurementSourceRef,
	measurementMode,
	measurementInProgress,
	measurements,
	getLayerConfig,
	encodeByCoordType,
	decodeByCoordType
}) {
	let measurementDrawInteraction = null
	let nextMeasurementId = 1

	function mapCoordinateTree(coordinates, transform) {
		if (!Array.isArray(coordinates)) {
			return coordinates
		}
		if (typeof coordinates[0] === 'number') {
			return transform(coordinates)
		}
		return coordinates.map((coordinate) => mapCoordinateTree(coordinate, transform))
	}

	function createMeasurementGeometry(type, coordinates) {
		return type === 'distance'
			? new LineString(coordinates)
			: new Polygon(coordinates)
	}

	function renderMeasurements() {
		if (!measurementSourceRef.value) {
			return
		}
		const coordType = getLayerConfig().coordType
		measurements.value.forEach((measurement) => {
			const feature = measurementSourceRef.value.getFeatures().find(
				(item) => item.get('measurementId') === measurement.id
			)
			if (!feature) {
				return
			}
			const coordinates = mapCoordinateTree(measurement.coordinates, (coordinate) => {
				return fromLonLat(encodeByCoordType(coordinate, coordType))
			})
			feature.setGeometry(createMeasurementGeometry(measurement.type, coordinates))
		})
	}

	function createCircleCoordinates(center, radius) {
		const segments = 96
		const ring = []
		for (let index = 0; index <= segments; index += 1) {
			ring.push(offset(center, radius, (index / segments) * Math.PI * 2))
		}
		return [ring]
	}

	function stopMeasurement() {
		if (measurementDrawInteraction) {
			const interaction = measurementDrawInteraction
			measurementDrawInteraction = null
			interaction.setActive(false)
			interaction.abortDrawing()
			interaction.getOverlay().getSource().clear()
			if (mapRef.value) {
				mapRef.value.removeInteraction(interaction)
			}
		}
		measurementMode.value = ''
		measurementInProgress.value = false
	}

	function startMeasurement(type) {
		if (!mapRef.value || !measurementSourceRef.value) {
			uni.showToast({ title: '地图尚未准备好，请稍后重试', icon: 'none' })
			return
		}
		if (measurementMode.value === type) {
			stopMeasurement()
			return
		}
		stopMeasurement()
		measurementMode.value = type
		measurementDrawInteraction = new Draw({
			source: measurementSourceRef.value,
			type: type === 'area' ? 'Polygon' : 'LineString',
			condition: primaryAction,
			geometryFunction: type === 'circle'
				? (coordinates, geometry) => {
					const center = coordinates[0]
					const edge = coordinates[coordinates.length - 1]
					const radius = Math.hypot(edge[0] - center[0], edge[1] - center[1])
					if (geometry) {
						geometry.setCenterAndRadius(center, radius)
						return geometry
					}
					return new CircleGeom(center, radius)
				}
				: undefined
		})
		measurementDrawInteraction.on('drawstart', () => {
			measurementInProgress.value = true
		})
		measurementDrawInteraction.on('drawabort', () => {
			measurementInProgress.value = false
		})
		let measurementCompleted = false
		measurementDrawInteraction.on('drawend', (event) => {
			if (measurementCompleted) {
				return
			}
			measurementCompleted = true
			measurementInProgress.value = false
			const coordType = getLayerConfig().coordType
			const id = nextMeasurementId++
			let coordinates
			let measurement
			if (type === 'circle') {
				const circle = event.feature.getGeometry()
				const center3857 = circle.getCenter()
				const center = decodeByCoordType(toLonLat(center3857), coordType)
				const edge = decodeByCoordType(
					toLonLat([center3857[0] + circle.getRadius(), center3857[1]]),
					coordType
				)
				const radius = getDistance(center, edge)
				coordinates = createCircleCoordinates(center, radius)
				measurement = {
					id,
					type,
					coordinates,
					perimeter: 2 * Math.PI * radius,
					area: Math.PI * radius * radius
				}
			} else {
				const geographicGeometry = event.feature.getGeometry().clone().transform('EPSG:3857', 'EPSG:4326')
				coordinates = mapCoordinateTree(geographicGeometry.getCoordinates(), (coordinate) => {
					return decodeByCoordType(coordinate, coordType)
				})
				const geometryWgs84 = createMeasurementGeometry(type, coordinates)
				measurement = { id, type, coordinates }
				if (type === 'distance') {
					measurement.distance = getLength(geometryWgs84, { projection: 'EPSG:4326' })
				} else {
					measurement.area = getArea(geometryWgs84, { projection: 'EPSG:4326' })
				}
			}
			measurements.value.push(measurement)

			event.feature.set('measurementId', id)
			event.feature.setStyle(new Style({
				fill: new Fill({ color: 'rgba(255, 183, 3, 0.18)' }),
				stroke: new Stroke({ color: '#f08c00', width: 3 }),
				image: new CircleStyle({
					radius: 5,
					fill: new Fill({ color: '#f08c00' }),
					stroke: new Stroke({ color: '#ffffff', width: 2 })
				}),
				text: new Text({
					text: formatMeasurement(measurement),
					font: '600 13px sans-serif',
					fill: new Fill({ color: '#183153' }),
					backgroundFill: new Fill({ color: 'rgba(255, 255, 255, 0.9)' }),
					padding: [4, 6, 4, 6],
					overflow: true
				})
			}))
			event.feature.setGeometry(createMeasurementGeometry(
				type,
				mapCoordinateTree(coordinates, (coordinate) => {
					return fromLonLat(encodeByCoordType(coordinate, coordType))
				})
			))
			stopMeasurement()
		})
		mapRef.value.addInteraction(measurementDrawInteraction)
	}

	function formatMeasurement(measurement) {
		if (measurement.type === 'distance') {
			return formatDistance(measurement.distance)
		}
		if (measurement.type === 'circle') {
			return `周长 ${formatDistance(measurement.perimeter)} / 面积 ${formatArea(measurement.area)}`
		}
		return formatArea(measurement.area)
	}

	function formatDistance(distance) {
		return distance < 1000
			? `${distance.toFixed(1)} 米`
			: `${(distance / 1000).toFixed(3)} 千米`
	}

	function formatArea(area) {
		return area < 1000000
			? `${area.toFixed(1)} 平方米`
			: `${(area / 1000000).toFixed(3)} 平方千米`
	}

	function removeMeasurement(id) {
		const feature = measurementSourceRef.value && measurementSourceRef.value.getFeatures().find(
			(item) => item.get('measurementId') === id
		)
		if (feature) {
			measurementSourceRef.value.removeFeature(feature)
		}
		measurements.value = measurements.value.filter((item) => item.id !== id)
	}

	function clearMeasurements() {
		stopMeasurement()
		if (measurementSourceRef.value) {
			measurementSourceRef.value.clear(true)
		}
		measurements.value = []
	}

	return {
		startMeasurement,
		stopMeasurement,
		renderMeasurements,
		formatMeasurement,
		formatDistance,
		formatArea,
		removeMeasurement,
		clearMeasurements
	}
}
