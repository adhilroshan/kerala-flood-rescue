import type { StopDefinition } from './types';

export const STOPS: readonly StopDefinition[] = [
  {
    id: 'shelter',
    label: 'Relief shelter',
    x: 0,
    z: 15,
    evacuees: 0,
    supplyRequested: false,
    story: 'Volunteers are ready to receive neighbors and load supplies.',
  },
  {
    id: 'house-a',
    label: 'Canal house',
    x: -39.8,
    z: -9.3,
    evacuees: 2,
    supplyRequested: true,
    story: 'Two neighbors wait by the upper landing. Nearby families need a crate of supplies.',
  },
  {
    id: 'house-b',
    label: 'Palm lane',
    x: 35.4,
    z: -26.6,
    evacuees: 1,
    supplyRequested: true,
    story: 'One neighbor is ready to leave. Others staying nearby need supplies.',
  },
  {
    id: 'house-c',
    label: 'School road',
    x: -5.7,
    z: -49.1,
    evacuees: 1,
    supplyRequested: false,
    story: 'A neighbor signals from a shaded porch and asks for a safe ride to the shelter.',
  },
];
