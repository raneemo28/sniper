import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { GLTF }       from 'three/examples/jsm/loaders/GLTFLoader';

const loader = new GLTFLoader();

export function loadModel(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf: GLTF) => {
        // Enable shadows on every mesh inside the model
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow    = true;
            child.receiveShadow = true;
          }
        });
        resolve(gltf.scene);
      },
      undefined,
      (error) => {
        console.error(`[loader] Failed to load model: ${url}`, error);
        reject(error);
      }
    );
  });
}

export async function preloadModels(
  urls: string[]
): Promise<Map<string, THREE.Group>> {
  const entries = await Promise.all(
    urls.map(async (url) => [url, await loadModel(url)] as const)
  );
  return new Map(entries);
}
