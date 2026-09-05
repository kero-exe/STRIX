export interface MapProps {
  districts: {
    type: 'FeatureCollection';
    features: unknown[];
  };
}

export type MapViewModel = MapProps;

export function createMapViewModel(districts: MapProps['districts']): MapViewModel {
  return { districts };
}
