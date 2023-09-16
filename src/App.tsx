import { useEffect } from 'react';
import './App.css';
import * as THREE from 'three';

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
  const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 1, 1000);

  // 映像の左側3/4部分を切り取る
  const fullWidth = sizes.width;
  const fullHeight = sizes.height;
  const xOffset = 0; // 左側から切り取るのでオフセットは0
  const yOffset = fullHeight * 0.125; // 上下の中心をとるためのオフセット
  const width = fullWidth * 0.75; // 映像の3/4の幅
  const height = fullHeight * 0.75; // 映像の3/4の高さ

  camera.setViewOffset(fullWidth, fullHeight, xOffset, yOffset, width, height);

  return camera;
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
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  return renderer;
}

// カメラのアニメーションを設定
function setupCameraAnimation(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  let angle = 0; // 初期角度
  const radius = 3; // 半径
  const angularSpeed = 0.006; // 角速度（ラジアン/フレーム）

  const tick = () => {
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

// 座標データから四面体を作成（InstancedMeshを使用）
function createTetrahedraFromCoordinates(coords: THREE.Vector3[], material: THREE.Material): THREE.InstancedMesh {
  const geometry = new THREE.TetrahedronGeometry(0.006);  // 球を四面体に変更
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

// Point Cloudの作成を行う関数
async function createPointCloud(scene: THREE.Scene): Promise<{ instancedMesh: THREE.InstancedMesh, teapotCoords: THREE.Vector3[], brainCoords: THREE.Vector3[], lightbulbCoords: THREE.Vector3[], teapotColor: THREE.Color, brainColor: THREE.Color, lightbulbColor: THREE.Color }> {
  const [teapotCoords, brainCoords, lightbulbCoords] = await Promise.all([
    fetchCoordinates('coordinates_teapot.txt'),
    fetchCoordinates('coordinates_brain.txt'),
    fetchCoordinates('coordinates_lightbulb.txt')
  ]);

  const teapotColor = new THREE.Color(0xffffff); // white color for teapot
  const brainColor = new THREE.Color(0x91a5ff);  // blue color for brain
  const lightbulbColor = new THREE.Color(0xff9191); // red color for lightbulb

  const material = new THREE.MeshBasicMaterial({ color: teapotColor }); 
  const instancedMesh = createTetrahedraFromCoordinates(teapotCoords, material);
  scene.add(instancedMesh);

  return { instancedMesh, teapotCoords, brainCoords, lightbulbCoords, teapotColor, brainColor, lightbulbColor };
}

// Point Cloudのアニメーションを設定
let animateEndName: string = 'teapot';
function animateFromTo(instancedMesh: THREE.InstancedMesh, startName: string, coordMapping: { [key: string]: THREE.Vector3[] }, colorMapping: { [key: string]: THREE.Color }, endName: string, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const startCoords = coordMapping[startName];
  const endCoords = coordMapping[endName];
  const startColor = colorMapping[startName];
  const endColor = colorMapping[endName];

  let startTime: number | null = null;
  let animationFrameId: number | null = null;

  function easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  const duration = 1200;
  const tick = (time: number) => {
    if (startTime === null) {
      startTime = time;
    }
    const elapsedTime = time - startTime;
    const dummy = new THREE.Object3D();
    if (elapsedTime <= duration) {
      const t = easeInOut(elapsedTime / duration);

      // 色の補間
      const currentColor = new THREE.Color().lerpColors(startColor, endColor, t);

      if (Array.isArray(instancedMesh.material)) {
        instancedMesh.material.forEach(mat => {
          if (mat instanceof THREE.MeshBasicMaterial) {
            mat.color = currentColor;
          }
        });
      } else if (instancedMesh.material instanceof THREE.MeshBasicMaterial) {
        instancedMesh.material.color = currentColor;
      }

      startCoords.forEach((start, i) => {
        const end = endCoords[i];
        dummy.position.lerpVectors(start, end, t);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      });
      instancedMesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(tick);
    } else {
      animateEndName = endName;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    }
  };

  animationFrameId = requestAnimationFrame(tick);
}

// Appコンポーネント
function App() {
  let currentMesh: THREE.InstancedMesh | null = null;

  useEffect(() => {
    const canvas = getCanvas();
    const sizes = { width: window.innerWidth, height: window.innerHeight };
    const scene = createScene();
    const camera = createCamera(sizes);
    const ambientLight = createLight();
    scene.add(ambientLight);
    const renderer = createRenderer(canvas, sizes);

    setupCameraAnimation(camera, renderer, scene);

    const animateSection = (type: string) => {
      const prevMesh = currentMesh;

      createPointCloud(scene).then(({ instancedMesh, teapotCoords, brainCoords, lightbulbCoords, teapotColor, brainColor, lightbulbColor }) => {
        currentMesh = instancedMesh;
        const coordMapping = {
          'teapot': teapotCoords,
          'brain': brainCoords,
          'lightbulb': lightbulbCoords
        };
        
        const colorMapping = {
          'teapot': teapotColor,
          'brain': brainColor,
          'lightbulb': lightbulbColor
        };
        if (instancedMesh) {
          animateFromTo(instancedMesh, animateEndName, coordMapping, colorMapping, type, renderer, scene, camera);
  
          // 0.01秒後に前のメッシュを削除
          setTimeout(() => {
            if (prevMesh) {
              scene.remove(prevMesh);
            }
          }, 1);
        }
      });
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          switch (entry.target.className) {
            case 'Section1':
              animateSection('teapot');
              break;
            case 'Section2':
              animateSection('brain');
              break;
            case 'Section3':
              animateSection('lightbulb');
              break;
            default:
              break;
          }
        }
      });
    };

    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5
    };

    const observer = new IntersectionObserver(handleIntersection, options);
    document.querySelectorAll('.Section1, .Section2, .Section3').forEach(section => {
      observer.observe(section as Element);
    });

    return () => {
      document.querySelectorAll('.Section1, .Section2, .Section3').forEach(section => {
        observer.unobserve(section as Element);
      });
      if (currentMesh) {
        scene.remove(currentMesh);
      }
    };
  }, []);

  return (
    <>
      <canvas id="canvas"></canvas>
      <div className="Section1">
        <h2>Section1</h2>
        <p>point cloud</p>
      </div>
      <div className="Section2">
        <h2>Section2</h2>
        <p>point cloud</p>
      </div>
      <div className="Section3">
        <h2>Section3</h2>
        <p>point cloud</p>
      </div>
    </>
  );
}

export default App;
