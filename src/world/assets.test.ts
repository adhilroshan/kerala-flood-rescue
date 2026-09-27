import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { loadAssetSet, validateAssetPath, type AssetEntry } from './assets';
import assetManifest from '../../public/assets/manifest.json';

const entry = (id: string, critical: boolean): AssetEntry => ({
  id, path: `/assets/${id}.glb`, critical,
  source: 'https://polyhaven.com', author: 'Author', license: 'CC0', version: '1', processing: 'none',
});

test('critical model failures identify the missing model instead of launching an incomplete scene', async () => {
  const load = vi.fn(async () => { throw new Error('404'); });
  await expect(loadAssetSet([entry('boat', true)], load)).rejects.toThrow(/boat/);
});

test('decorative model failures do not suppress required models', async () => {
  const progress = vi.fn();
  const assets = await loadAssetSet([entry('boat', true), entry('plant', false)],
    async (path) => {
      if (path.includes('plant')) throw new Error('404');
      return new THREE.Group();
    }, progress);
  expect(assets.models.has('boat')).toBe(true);
  expect(assets.models.has('plant')).toBe(false);
  expect(progress).toHaveBeenLastCalledWith(2, 2);
});

test('runtime assets must be bundled, not loaded from third-party hosts', () => {
  expect(() => validateAssetPath('https://elsewhere.example/boat.glb')).toThrow(/local/);
  expect(() => validateAssetPath('/assets/boat.glb')).not.toThrow();
});

test('every bundled material has a local file and recorded free-use provenance', () => {
  const manifest = assetManifest as AssetEntry[];
  expect(manifest.length).toBeGreaterThan(0);
  expect(manifest.map((asset) => asset.id)).toEqual(expect.arrayContaining([
    'roof', 'roofNormal', 'plaster', 'plasterNormal', 'timber', 'timberNormal',
  ]));
  for (const asset of manifest) {
    validateAssetPath(asset.path);
    expect(asset.source).toMatch(/^https:\/\//);
    expect(asset.author.length).toBeGreaterThan(0);
    expect(asset.license).toMatch(/CC0/i);
  }
});
