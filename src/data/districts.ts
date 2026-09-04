export type DistrictStatus = 'DISCOVERED' | 'CONTESTED' | 'ACTIVE' | 'UNKNOWN';

export interface DistrictGeometryProperties {
  id: string;
  name: string;
}

export interface DistrictData {
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
  properties: DistrictGeometryProperties;
  geometry: DistrictGeometry;
}

export interface DistrictFeatureCollection {
  type: 'FeatureCollection';
  features: DistrictFeature[];
}

export const districtsGeoJsonPath = '/data/districts.geojson';
