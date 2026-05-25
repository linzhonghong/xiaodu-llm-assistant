export type EntityMapping = {
  name: string;
  entityId: string;
  domain: 'light' | 'climate';
};

export const entityMappings: EntityMapping[] = [
  { name: '客厅灯', entityId: 'light.living_room', domain: 'light' },
  { name: '卧室灯', entityId: 'light.bedroom', domain: 'light' },
  { name: '客厅空调', entityId: 'climate.living_room_ac', domain: 'climate' }
];

export function findEntity(query: string): EntityMapping | undefined {
  return entityMappings.find((entity) => query.includes(entity.name));
}
