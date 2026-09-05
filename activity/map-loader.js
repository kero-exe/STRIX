window.addEventListener('load', () => {
  const mapContainer = document.querySelector('#district-map');

  if (!mapContainer) return;

  if (!window.maplibregl) {
    console.error('MapLibre GL did not load before initDistrictMap was called.');
    return;
  }

  import('./map.js').then(({ initDistrictMap }) => {
    return initDistrictMap({
      container: mapContainer,
      defaultCenter: [-73.9857, 40.7484],
      defaultZoom: 11.5,
      minZoom: 10,
      maxZoom: 15
    });
  }).catch((error) => {
    console.error('Failed to load the STRIX map module.', error);
  });
});
