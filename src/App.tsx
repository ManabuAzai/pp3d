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

function App() {
  useEffect(() => {
    // Canvasの取得
    const canvas: HTMLCanvasElement = document.getElementById("canvas") as HTMLCanvasElement;
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    // Sceneの設定
    const scene: THREE.Scene = new THREE.Scene();

    // Cameraの設定
    const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      1.2,
      1000
    );

    // Lightの設定
    const ambientLight: THREE.AmbientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    // Rendererの設定
    const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(window.devicePixelRatio);

    let teapotCoords: THREE.Vector3[] = [];
    let brainCoords: THREE.Vector3[] = [];
    let instancedMesh: THREE.InstancedMesh;

    Promise.all([
      fetchCoordinates('coordinates_brain.txt'),
      fetchCoordinates('coordinates_teapot.txt'),

    ]).then(([teapot, brain]) => {
      teapotCoords = teapot;
      brainCoords = brain;

      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      instancedMesh = createSpheresFromCoordinates(teapotCoords, material);
      scene.add(instancedMesh);
    });

    let startTime: number | null = null;

    // Animationの設定
    let angle = 0; // 初期角度
    const radius = 3; // 半径
    const angularSpeed = 0.005; // 角速度（ラジアン/フレーム）

    const tick = (time: number) => {
      if (startTime === null) {
        startTime = time;
      }

      const elapsedTime = time - startTime;
      const duration = 1500; // 変化の時間（ミリ秒）

      if (elapsedTime <= duration && instancedMesh && teapotCoords.length && brainCoords.length) {
        const t = elapsedTime / duration;
        const dummy = new THREE.Object3D();

        teapotCoords.forEach((start, i) => {
          const end = brainCoords[i];
          dummy.position.lerpVectors(start, end, t);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
        });

        instancedMesh.instanceMatrix.needsUpdate = true;
      }

      // カメラの位置を更新（Z軸を中心に半径3の円を描く）
      camera.position.x = radius * Math.cos(angle);
      camera.position.y = radius * Math.sin(angle);
      camera.position.z = 0; // Z軸上に固定
      camera.up.set(0, 0, 1); // カメラの上方向をZ軸に設定

      // カメラを原点に向ける
      camera.lookAt(0, 0, 0);

      // 角度を更新
      angle += angularSpeed;

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, []);

  return (
    <>
      <canvas id="canvas"></canvas>
      <div className="mainContent">
        <h2>AM</h2>
        <p>point cloud</p>
      </div>
    </>
  );
}

export default App;
