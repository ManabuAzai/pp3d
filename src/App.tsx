import { useEffect } from 'react';
import './App.css';
import * as THREE from 'three';

// 座標データの非同期読み込み
async function fetchCoordinates(filename: string): Promise<THREE.Vector3[]> {
  const response = await fetch(`./models/${filename}`);
  const text = await response.text();
  const lines = text.split('\n');
  return lines.map(line => {
    const [x, y, z] = line.split(',').map(Number);
    return new THREE.Vector3(x, y, z);
  });
}

// 座標データから球を作成（InstancedMeshを使用）
function createSpheresFromCoordinates(coords: THREE.Vector3[], material: THREE.Material): THREE.InstancedMesh {
  const geometry = new THREE.SphereGeometry(0.003);
  const instancedMesh = new THREE.InstancedMesh(geometry, material, coords.length);

  const dummy = new THREE.Object3D();

  coords.forEach((coord, i) => {
    dummy.position.copy(coord);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
  });

  instancedMesh.instanceMatrix.needsUpdate = true;

  return instancedMesh;
}

// Canvasを取得する関数
function getCanvas(): HTMLCanvasElement {
  // Canvasの取得
  return document.getElementById("canvas") as HTMLCanvasElement;
}

// Sceneを作成する関数
function createScene(): THREE.Scene {
  // Sceneの設定
  return new THREE.Scene();
}

// Cameraを作成する関数
function createCamera(sizes: { width: number, height: number }): THREE.PerspectiveCamera {
  // Cameraの設定
  return new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 1, 1000);
}

// Lightを作成する関数
function createLight(): THREE.AmbientLight {
  // Lightの設定
  return new THREE.AmbientLight(0xffffff, 1);
}

// Rendererを作成する関数
function createRenderer(canvas: HTMLCanvasElement, sizes: { width: number, height: number }): THREE.WebGLRenderer {
  // Rendererの設定
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
  });
  renderer.setSize(sizes.width*1.4, sizes.height*1.4);
  renderer.setPixelRatio(window.devicePixelRatio);
  return renderer;
}

// Point Cloudの作成を行う関数
async function createPointCloud(scene: THREE.Scene): Promise<{ instancedMesh: THREE.InstancedMesh, teapotCoords: THREE.Vector3[], brainCoords: THREE.Vector3[], lightbulbCoords: THREE.Vector3[] }> {
  const [teapotCoords, brainCoords, lightbulbCoords] = await Promise.all([
    fetchCoordinates('coordinates_teapot.txt'),
    fetchCoordinates('coordinates_brain.txt'),
    fetchCoordinates('coordinates_lightbulb.txt')
  ]);

  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const instancedMesh = createSpheresFromCoordinates(teapotCoords, material);
  scene.add(instancedMesh);

  return { instancedMesh, teapotCoords, brainCoords, lightbulbCoords };
}

// Animationの設定
function setupAnimation(instancedMesh: THREE.InstancedMesh, teapotCoords: THREE.Vector3[], brainCoords: THREE.Vector3[], lightbulbCoords: THREE.Vector3[], camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  let startTime: number | null = null;

  function easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  let angle = 0; // 初期角度
  const radius = 3; // 半径
  const angularSpeed = 0.006; // 角速度（ラジアン/フレーム）

  const tick = (time: number) => {
    if (startTime === null) {
      startTime = time;
    }

    const elapsedTime = time - startTime;
    const duration = 1200; // 変化の時間（ミリ秒）

    const dummy = new THREE.Object3D();

    if (elapsedTime <= duration && instancedMesh && teapotCoords.length && brainCoords.length) {
      const t = easeInOut(elapsedTime / duration);
      teapotCoords.forEach((start, i) => {
        const end = brainCoords[i];
        dummy.position.lerpVectors(start, end, t);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      });
    } else if (elapsedTime <= 2 * duration && instancedMesh && brainCoords.length && lightbulbCoords.length) {
      const t = easeInOut((elapsedTime - duration) / duration);
      brainCoords.forEach((start, i) => {
        const end = lightbulbCoords[i];
        dummy.position.lerpVectors(start, end, t);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      });
    }

    instancedMesh.instanceMatrix.needsUpdate = true;

    // カメラの位置を更新
    camera.position.x = radius * Math.cos(angle);
    camera.position.y = radius * Math.sin(angle);
    camera.position.z = 0;
    camera.up.set(0, 0, 1);

    // カメラを原点に向ける
    camera.lookAt(0, 0, 0);

    // 角度を更新
    angle += angularSpeed;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}


function App() {
  useEffect(() => {
    const canvas = getCanvas();
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    const scene = createScene();
    const camera = createCamera(sizes);
    const ambientLight = createLight();
    scene.add(ambientLight);
    const renderer = createRenderer(canvas, sizes);

    createPointCloud(scene).then(({ instancedMesh, teapotCoords, brainCoords, lightbulbCoords }) => {
      if (instancedMesh) {
        setupAnimation(instancedMesh, teapotCoords, brainCoords, lightbulbCoords, camera, renderer, scene);
      }
    });
  }, []);

  return (
    <>
      <canvas id="canvas"></canvas>
      <div className="Section1">
        <h2>Section1</h2>
        <p>point cloud</p>
      </div>
      {/* <div className="Section2">
        <h2>Section2</h2>
        <p>point cloud</p>
      </div>
      <div className="Section3">
        <h2>Section3</h2>
        <p>point cloud</p>
      </div> */}
    </>
  );
}

export default App;