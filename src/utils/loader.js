import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
const loader = new GLTFLoader();
export function loadModel(url) {
    return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => {
            // Enable shadows on every mesh inside the model
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            resolve(gltf.scene);
        }, undefined, (error) => {
            console.error(`[loader] Failed to load model: ${url}`, error);
            reject(error);
        });
    });
}
export async function preloadModels(urls) {
    const entries = await Promise.all(urls.map(async (url) => [url, await loadModel(url)]));
    return new Map(entries);
}
