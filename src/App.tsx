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
  const width = fullWidth * 0.67;
  const height = fullHeight * 0.67;

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
  let time = 0; // 時間の初期値
  const frequency = 3; // 揺れの周波数
  let angle = 2.3; // 初期角度
  const radius = 3; // 半径
  const angularSpeed = 0.006; // 角速度（ラジアン/フレーム）
  const lookAtAmplitude = 0.06; // lookAtの振幅

  const tick = () => {
    // カメラの位置を更新
    camera.position.x = radius * Math.cos(angle);
    camera.position.y = radius * Math.sin(angle);
    camera.position.z = 0;
    camera.up.set(0, 0, 1);
    // カメラを原点に向ける
    camera.lookAt(0, lookAtAmplitude * Math.sin(frequency * time), lookAtAmplitude * Math.cos(frequency * time));
    // 角度を更新
    angle += angularSpeed;
    time += 0.01;
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

// 座標データから立方体を作成（InstancedMeshを使用）
function createCuboidsFromCoordinates(coords: THREE.Vector3[], material: THREE.Material): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(0.006, 0.006, 0.006);
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
async function createPointCloud(scene: THREE.Scene): Promise<{ instancedMesh: THREE.InstancedMesh, FirstCoords: THREE.Vector3[], SecondCoords: THREE.Vector3[], ThirdCoords: THREE.Vector3[], randomCoords: THREE.Vector3[], FirstColor: THREE.Color, SecondColor: THREE.Color, ThirdColor: THREE.Color, randomColor: THREE.Color }> {
  const [FirstCoords, SecondCoords, ThirdCoords, randomCoords] = await Promise.all([
    // fetchCoordinates('coordinates_teapot.txt'),
    // fetchCoordinates('coordinates_earth.txt'),
    fetchCoordinates('coordinates_box.txt'),
    fetchCoordinates('coordinates_brain.txt'),
    fetchCoordinates('coordinates_lightbulb.txt'),
    fetchCoordinates('coordinates_randam.txt')
  ]);
  // 色を設定
  const FirstColor = new THREE.Color(0xffffff);
  const SecondColor = new THREE.Color(0xbfc6ff);
  const ThirdColor = new THREE.Color(0xffbfbf);
  const randomColor = new THREE.Color(0xffffff);
  const material = new THREE.MeshBasicMaterial({ color: FirstColor }); 
  const instancedMesh = createCuboidsFromCoordinates(FirstCoords, material); // ここを修正
  scene.add(instancedMesh);

  return { instancedMesh, FirstCoords, SecondCoords, ThirdCoords, randomCoords, FirstColor, SecondColor, ThirdColor, randomColor };
}

// Point Cloudのアニメーションを設定
let animateEndName: string = 'First';
function animateFromTo(instancedMesh: THREE.InstancedMesh, startName: string, coordMapping: { [key: string]: THREE.Vector3[] }, colorMapping: { [key: string]: THREE.Color }, endName: string, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const startCoords = coordMapping[startName];
  const endCoords = coordMapping[endName];
  const startColor = colorMapping[startName];
  const endColor = colorMapping[endName];
  let startTime: number | null = null;
  let animationFrameId: number | null = null;
  function easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    // const c4 = (2 * Math.PI) / 3;
    // return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
  const duration = 900;
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

function animateFromFrom(instancedMesh: THREE.InstancedMesh, startName: string, coordMapping: { [key: string]: THREE.Vector3[] }, colorMapping: { [key: string]: THREE.Color }, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const startCoords = coordMapping[startName];
    const randomCoords = coordMapping['random'];
    const startColor = colorMapping[startName];
    const randomColor = colorMapping[startName];
    let startTime: number | null = null;
    let animationFrameId: number | null = null;

    function easeInOut(t: number): number {
        // return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -50 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;  
    }
    const duration = 3000;
    const tick = (time: number) => {
        if (startTime === null) {
            startTime = time;
        }
        const elapsedTime = time - startTime;
        const dummy = new THREE.Object3D();
        if (elapsedTime <= duration) {
            const t = easeInOut(elapsedTime / duration);
            // 中間点でrandomCoordsに遷移
            const currentCoords = t < 0.5 ? startCoords : randomCoords;
            let targetCoords = t < 0.5 ? randomCoords : startCoords;
            // 色の補間
            const currentColor = new THREE.Color().lerpColors(startColor, randomColor, t * 2);
            if (Array.isArray(instancedMesh.material)) {
                instancedMesh.material.forEach(mat => {
                    if (mat instanceof THREE.MeshBasicMaterial) {
                        mat.color = currentColor;
                    }
                });
            } else if (instancedMesh.material instanceof THREE.MeshBasicMaterial) {
                instancedMesh.material.color = currentColor;
            }
            currentCoords.forEach((current, i) => {
                const target = targetCoords[i];
                dummy.position.lerpVectors(current, target, t);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(i, dummy.matrix);
            });
            instancedMesh.instanceMatrix.needsUpdate = true;
            renderer.render(scene, camera);
            animationFrameId = requestAnimationFrame(tick);
        } else {
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

      createPointCloud(scene).then(({ instancedMesh, FirstCoords, SecondCoords, ThirdCoords, randomCoords, FirstColor, SecondColor, ThirdColor, randomColor }) => {
        currentMesh = instancedMesh;
        const coordMapping = {'First': FirstCoords, 'Second': SecondCoords, 'Third': ThirdCoords, 'random': randomCoords};
        const colorMapping = {'First': FirstColor, 'Second': SecondColor, 'Third': ThirdColor, 'random': randomColor};
        if (instancedMesh) {
          if (type === 'fromFrom') {
            animateFromFrom(instancedMesh, animateEndName, coordMapping, colorMapping, renderer, scene, camera);
          } else {
            animateFromTo(instancedMesh, animateEndName, coordMapping, colorMapping, type, renderer, scene, camera);
          }
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
          let targetAnimation = "";
          switch (entry.target.id) {
            case 'Section1':
              targetAnimation = 'First';
              break;
            case 'Section2':
              targetAnimation = 'Second';
              break;
            case 'Section3':
              targetAnimation = 'Third';
              break;
            default:
              break;
          }
    
          // animateEndName と目的のセクション名が一致するか確認
          if (animateEndName === targetAnimation) {
            animateSection('fromFrom');
          } else {
            animateSection(targetAnimation);
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
    document.querySelectorAll('#Section1, #Section2, #Section3').forEach(section => {
      observer.observe(section as Element);
    });
    return () => {
      document.querySelectorAll('#Section1, #Section2, #Section3').forEach(section => {
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
      <div id="Section1">
        <h2>Accelerating Business Through Technology</h2>
        <p>「テクノロジーでビジネスを加速する」世界のAI技術とデジタルマーケティングでビジネスを向上させるテクノロジーコンサルティングファーム</p>
      </div>
      <div id="Section2">
        <h2>Utilizing Cutting-Edge AI Technology to Lead the Industry: Offering AI Product Development, AI-Powered Consulting, and AI-Driven Marketing Solutions</h2>
        <p>最先端のAI技術を利活用し、業界をリードする。AIプロダクト開発、AI活用コンサルティング、マーケティング施策へのAI活用を提供</p>
      </div>
      <div id="Section3">
        <h2>Specializing in Business Improvement Through Digital Marketing: End-to-End Support from Consultants with Experience in Consulting Firms and the Creative Industry</h2>
        <p>デジタルマーケティングによる経営改善支援を得意とし、ファームやクリエイティブ業界で経験を積んだコンサルタントが一気通貫でサポート</p>
      </div>
    </>
  );
}

export default App;