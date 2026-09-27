import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface AssetEntry {
  id: string;
  path: string;
  critical: boolean;
  source: string;
  author: string;
  license: string;
  version: string;
  processing: string;
  kind?: 'model' | 'texture';
}

export interface WorldAssets {
  models: Map<string, THREE.Group>;
  textures: Map<string, THREE.Texture>;
}

export function validateAssetPath(path: string): void {
  if (!/^\/assets\/[a-z0-9/_-]+\.(glb|gltf|ktx2|webp|png|jpg)$/i.test(path)) {
    throw new Error(`Asset must be bundled locally: ${path}`);
  }
}

export async function loadAssetSet(
  entries: AssetEntry[],
  load: (path: string) => Promise<THREE.Group>,
  onProgress?: (loaded: number, total: number) => void,
): Promise<WorldAssets> {
  const assets: WorldAssets = { models: new Map(), textures: new Map() };
  let completed = 0;
  for (const entry of entries) {
    validateAssetPath(entry.path);
    try {
      assets.models.set(entry.id, await load(entry.path));
    } catch (error) {
      if (entry.critical) throw new Error(`Could not load ${entry.id}`, { cause: error });
    }
    onProgress?.(++completed, entries.length);
  }
  return assets;
}

export async function loadWorldAssets(onProgress?: (loaded: number, total: number) => void): Promise<WorldAssets> {
  const response = await fetch('/assets/manifest.json');
  if (!response.ok) throw new Error('Could not load the local asset catalog');
  const entries = await response.json() as AssetEntry[];
  const models = entries.filter((entry) => entry.kind === 'model');
  const textures = entries.filter((entry) => entry.kind === 'texture');
  const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700;
  const gltf = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const assets = await loadAssetSet(models, async (path) => (await gltf.loadAsync(path)).scene,
    (loaded) => onProgress?.(loaded, entries.length));
  let completed = models.length;
  await Promise.all(textures.map(async (entry) => {
    validateAssetPath(entry.path);
    try {
      if (isMobile && entry.id.endsWith('Normal')) return;
      const texture = await textureLoader.loadAsync(entry.path);
      if (!entry.id.endsWith('Normal')) texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      assets.textures.set(entry.id, texture);
    } catch (error) {
      if (entry.critical) throw new Error(`Could not load ${entry.id}`, { cause: error });
    } finally {
      onProgress?.(++completed, entries.length);
    }
  }));
  return assets;
}
