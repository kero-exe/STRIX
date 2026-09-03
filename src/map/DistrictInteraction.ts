export function getDistrictId(feature: { properties?: { id?: string }; id?: string }) {
  return feature.properties?.id || feature.id || null;
}
