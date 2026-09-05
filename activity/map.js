const apiBaseUrl = String(window.STRIX_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
const districtGeoJsonUrl = apiBaseUrl
  ? `${apiBaseUrl}/api/districts`
  : new URL('./data/districts.geojson', import.meta.url).href;
const districtDataUrl = apiBaseUrl ? `${apiBaseUrl}/api/district-data` : null;
const mapStyleUrl = new URL('./map-style.json', import.meta.url).href;

function updateDistrictPanel(district) {
  const nameEl = document.getElementById('district-name');
  const statusEl = document.getElementById('district-status');
  const threatEl = document.getElementById('district-threat');
  const locationsEl = document.getElementById('district-locations');
  const missionsEl = document.getElementById('district-missions');
  const summaryEl = document.getElementById('district-summary');

  if (!district) {
    if (nameEl) nameEl.textContent = 'Select a district';
    if (statusEl) statusEl.textContent = 'Unknown';
    if (threatEl) threatEl.textContent = '--';
    if (locationsEl) locationsEl.textContent = '0';
    if (missionsEl) missionsEl.textContent = '0';
    if (summaryEl) summaryEl.textContent = 'Hover or click a district to inspect the current STRIX operational picture.';
    return;
  }

  if (nameEl) nameEl.textContent = district.name || 'District';
  if (statusEl) statusEl.textContent = district.status || 'Unknown';
  if (threatEl) threatEl.textContent = district.threat || '--';
  if (locationsEl) locationsEl.textContent = String(district.locations ?? 0);
  if (missionsEl) missionsEl.textContent = String(district.missions ?? 0);
  if (summaryEl) summaryEl.textContent = district.summary || 'No district summary available.';
}

export async function initDistrictMap({ container, defaultCenter, defaultZoom, minZoom, maxZoom }) {
  if (!container) return;

  const maplibregl = window.maplibregl;
  if (!maplibregl) {
    console.error('MapLibre GL failed to load. Check the browser network tab and ensure the CDN script is available.');
    return null;
  }

  const mapRoot = document.createElement('div');
  mapRoot.className = 'map-root';
  container.appendChild(mapRoot);
  const view3dToggle = document.getElementById('map-3d-toggle');

  const manhattanBounds = {
    west: -74.05,
    south: 40.68,
    east: -73.88,
    north: 40.82
  };

  const map = new maplibregl.Map({
    container: mapRoot,
    style: mapStyleUrl,
    center: defaultCenter,
    zoom: defaultZoom,
    minZoom,
    maxZoom,
    pitch: 0,
    bearing: 0,
    maxBounds: [
      [manhattanBounds.west, manhattanBounds.south],
      [manhattanBounds.east, manhattanBounds.north]
    ],
    maxBoundsViscosity: 0.8
  });

  map.getCanvas().style.cursor = 'crosshair';

  if (view3dToggle) {
    let twoDimensionalZoom = map.getZoom();

    view3dToggle.addEventListener('click', () => {
      const is3d = map.getPitch() === 0;
      if (is3d) {
        twoDimensionalZoom = map.getZoom();
      }

      map.easeTo({
        pitch: is3d ? 55 : 0,
        bearing: is3d ? -15 : 0,
        zoom: is3d ? Math.max(map.getZoom(), 14) : twoDimensionalZoom,
        duration: 900
      });
      view3dToggle.setAttribute('aria-pressed', String(is3d));
      view3dToggle.textContent = is3d ? 'View in 2D' : 'View in 3D';
    });
  }

  map.on('load', async () => {
    let districtGeoJson;
    let districtData;

    try {
      const geometryResponse = await fetch(districtGeoJsonUrl);
      if (!geometryResponse.ok) throw new Error(`District geometry request failed with status ${geometryResponse.status}.`);
      districtGeoJson = await geometryResponse.json();

      if (districtDataUrl) {
        const dataResponse = await fetch(districtDataUrl);
        if (!dataResponse.ok) throw new Error(`District data request failed with status ${dataResponse.status}.`);
        districtData = await dataResponse.json();
      } else {
        districtData = {
          districts: districtGeoJson.features.map(feature => feature.properties || {})
        };
      }
    } catch (error) {
      console.error('Failed to load district geometry and data.', error);
      return;
    }

    const districtDataById = new Map((districtData.districts || []).map(district => [district.id, district]));
    const getDistrict = feature => {
      const districtId = feature.id || feature.properties?.id;
      return districtDataById.get(districtId) || {
        id: districtId,
        name: feature.properties?.name || 'District',
        status: 'Unknown',
        threat: '--',
        locations: 0,
        missions: 0,
        summary: 'No district data available.'
      };
    };

    map.addSource('strix-districts', {
      type: 'geojson',
      promoteId: 'id',
      data: districtGeoJson
    });

    map.addLayer({
      id: 'district-fill',
      type: 'fill',
      source: 'strix-districts',
      paint: {
        'fill-color': '#ff9a4c',
        'fill-opacity': 0.2
      }
    });

    map.addLayer({
      id: 'district-borders',
      type: 'line',
      source: 'strix-districts',
      paint: {
        'line-color': '#ffd1a6',
        'line-width': 2,
        'line-opacity': 0.9
      }
    });

    map.addLayer({
      id: 'district-hover',
      type: 'line',
      source: 'strix-districts',
      paint: {
        'line-color': '#ffffff',
        'line-width': ['case', ['==', ['feature-state', 'hover'], true], 3, 0],
        'line-opacity': ['case', ['==', ['feature-state', 'hover'], true], 1, 0]
      }
    });

    map.addLayer({
      id: 'district-selected',
      type: 'line',
      source: 'strix-districts',
      paint: {
        'line-color': '#ff6d10',
        'line-width': ['case', ['==', ['feature-state', 'selected'], true], 3, 0],
        'line-opacity': ['case', ['==', ['feature-state', 'selected'], true], 1, 0]
      }
    });

    let hoveredFeatureId = null;
    let selectedFeatureId = null;

    const clearFeatureState = (key, featureId) => {
      if (!featureId) {
        return;
      }

      map.removeFeatureState({
        source: 'strix-districts',
        id: featureId
      }, key);
    };

    const setHoverState = (featureId) => {
      if (hoveredFeatureId === featureId) {
        return;
      }

      if (hoveredFeatureId) {
        clearFeatureState('hover', hoveredFeatureId);
      }

      hoveredFeatureId = featureId;
      if (featureId) {
        map.setFeatureState({
          source: 'strix-districts',
          id: featureId
        }, { hover: true });
      }
    };

    const setSelectedState = (featureId) => {
      if (selectedFeatureId === featureId) {
        return;
      }

      if (selectedFeatureId) {
        clearFeatureState('selected', selectedFeatureId);
      }

      selectedFeatureId = featureId;
      if (featureId) {
        map.setFeatureState({
          source: 'strix-districts',
          id: featureId
        }, { selected: true });
      }
    };

    let motionFrame = null;

    const handlePointerMove = (event) => {
      if (motionFrame) {
        cancelAnimationFrame(motionFrame);
      }

      motionFrame = requestAnimationFrame(() => {
        motionFrame = null;
        const features = map.queryRenderedFeatures(event.point, {
          layers: ['district-fill']
        });

        if (features.length) {
          const feature = features[0];
          const featureId = feature.id || feature.properties?.id || null;
          setHoverState(featureId);
          updateDistrictPanel(getDistrict(feature));
          return;
        }

        setHoverState(null);
        updateDistrictPanel(null);
      });
    };

    map.on('mousemove', (event) => {
      const coords = event.lngLat;
      const coordinatesEl = document.getElementById('cursor-coordinates');
      if (coordinatesEl) {
        coordinatesEl.textContent = `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`;
      }
      handlePointerMove(event);
    });

    map.on('mouseleave', () => {
      if (motionFrame) {
        cancelAnimationFrame(motionFrame);
        motionFrame = null;
      }
      const coordinatesEl = document.getElementById('cursor-coordinates');
      if (coordinatesEl) {
        coordinatesEl.textContent = 'Lat: --, Lng: --';
      }
      map.getCanvas().style.cursor = 'crosshair';
      setHoverState(null);
      updateDistrictPanel(null);
    });

    map.on('click', (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ['district-fill']
      });

      if (!features.length) return;

      const feature = features[0];
      const featureId = feature.id || feature.properties?.id || null;

      if (selectedFeatureId === featureId) {
        setSelectedState(null);
        setHoverState(null);
        updateDistrictPanel(null);
        return;
      }

      setSelectedState(featureId);
      updateDistrictPanel(getDistrict(feature));
    });

  });

  map.on('error', (event) => {
    const error = event.error || event;
    console.error('STRIX map error:', error);
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');

  return map;
}
