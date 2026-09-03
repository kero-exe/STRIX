export type DistrictStatus = 'DISCOVERED' | 'CONTESTED' | 'ACTIVE' | 'UNKNOWN';

export interface DistrictProperties {
  id: string;
  name: string;
  status: DistrictStatus;
  threat: string;
  locations: number;
  missions: number;
  summary: string;
}

export interface DistrictGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface DistrictFeature {
  type: 'Feature';
  id?: string;
  properties: DistrictProperties;
  geometry: DistrictGeometry;
}

export interface DistrictFeatureCollection {
  type: 'FeatureCollection';
  features: DistrictFeature[];
}

export const districtsGeoJsonPath = '/data/districts.geojson';
