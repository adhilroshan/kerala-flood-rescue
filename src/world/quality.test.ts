import { expect, test } from 'vitest';
import { chooseQuality } from './quality';

test('phone profile protects frame time without hiding mission-critical actors', () => {
  const phone = chooseQuality(true, false);
  const desktop = chooseQuality(false, false);
  expect(phone.pixelRatioCap).toBeLessThan(desktop.pixelRatioCap);
  expect(phone.shadowSize).toBeLessThan(desktop.shadowSize);
  expect(phone.foliageCount).toBeLessThan(desktop.foliageCount);
  expect(phone.showPeople).toBe(true);
  expect(phone.showDockMarkers).toBe(true);
  expect(phone.cameraFov).toBeGreaterThan(desktop.cameraFov);
  expect(phone.cameraDistance).toBeGreaterThan(desktop.cameraDistance);
});
