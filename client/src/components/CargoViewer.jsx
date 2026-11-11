import { Component, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Edges, Line } from '@react-three/drei';
import * as THREE from 'three';
import { colorForStop } from '../data/demo.js';
import Icon from './Icon.jsx';
import CargoLabel from './CargoLabel.jsx';

class ViewerBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="viewer-fallback">
        <Icon name="cube" size={42} />
        <strong>The 3D viewer needs WebGL</strong>
        <p>
          Enable hardware acceleration in your browser. Package coordinates and
          loading instructions are available below.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}

function CargoBox({
  item,
  vehicle,
  selected,
  onSelect,
  labels,
  byStop,
  unloaded,
  unloadDelay,
  ready,
  miniature,
}) {
  const ref = useRef();
  const elapsed = useRef(0);
  const [hovered, setHovered] = useState(false);
  useEffect(
    () => () => {
      document.body.style.cursor = 'auto';
    },
    [],
  );
  const scale = 100;
  const l = item.length / scale,
    w = item.width / scale,
    h = item.height / scale;
  const x = (item.x + item.length / 2 - vehicle.length / 2) / scale;
  const y = (item.z + item.height / 2) / scale;
  const z = (item.y + item.width / 2 - vehicle.width / 2) / scale;
  useEffect(() => {
    elapsed.current = 0;
  }, [unloaded, unloadDelay]);
  useFrame((_state, delta) => {
    if (!ref.current) return;
    elapsed.current += delta;
    const leaving = unloaded && elapsed.current >= unloadDelay;
    ref.current.position.x = THREE.MathUtils.damp(
      ref.current.position.x,
      leaving ? -vehicle.length / 100 - 3 : x,
      5,
      delta,
    );
    const pastDoor =
      ref.current.position.x + l / 2 < -vehicle.length / 200 - 0.05;
    ref.current.scale.setScalar(
      THREE.MathUtils.damp(
        ref.current.scale.x,
        leaving && pastDoor ? 0 : 1,
        6,
        delta,
      ),
    );
  });
  const color = byStop ? colorForStop(item.stop) : '#9faf9a';
  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(item.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            Math.max(l * 0.98, l - 0.018),
            Math.max(h * 0.98, h - 0.018),
            Math.max(w * 0.98, w - 0.018),
          ]}
        />
        <meshStandardMaterial
          color={selected ? '#e9c96b' : color}
          roughness={0.78}
          metalness={0.02}
          emissive={
            selected || hovered ? '#534621' : ready ? '#1e4533' : '#000000'
          }
          emissiveIntensity={selected || hovered ? 0.2 : 0.05}
        />
        <Edges
          color={selected ? '#8c6a22' : '#ffffff'}
          opacity={0.45}
          transparent
          threshold={15}
        />
      </mesh>
      <mesh position={[0, h / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[l * 0.12, Math.max(w * 0.95, w - 0.025)]} />
        <meshStandardMaterial color="#fff5dd" transparent opacity={0.28} />
      </mesh>
      {(labels || (hovered && !miniature)) && !unloaded && (
        <CargoLabel
          text={item.id}
          caption={`STOP ${item.stop}`}
          position={[0, h / 2 + 0.12, 0]}
          selected={selected}
        />
      )}
    </group>
  );
}

function Scene({
  vehicle,
  placed,
  selectedId,
  onSelect,
  labels,
  byStop,
  hidden,
  simulation,
  resetKey,
  miniature,
}) {
  const controls = useRef();
  const { camera, size } = useThree();
  const l = vehicle.length / 100,
    w = vehicle.width / 100,
    h = vehicle.height / 100;
  useEffect(() => {
    const radius = Math.sqrt(l * l + w * w + h * h) / 2;
    const distance =
      (radius /
        Math.sin(THREE.MathUtils.degToRad(19)) /
        Math.min(1, size.width / size.height)) *
      (miniature ? 1.08 : 1.02);
    const direction = new THREE.Vector3(-1, 0.68, 1.1)
      .normalize()
      .multiplyScalar(distance);
    camera.position.copy(direction).add(new THREE.Vector3(0, h * 0.4, 0));
    controls.current?.target.set(0, h * 0.4, 0);
    controls.current?.update();
  }, [resetKey, l, h, w, camera, size.width, size.height, miniature]);
  const doorWidth = vehicle.rearDoorWidth / 100,
    doorHeight = vehicle.rearDoorHeight / 100;
  return (
    <>
      <color attach="background" args={['#edf1eb']} />
      <ambientLight intensity={1.5} />
      <hemisphereLight args={['#ffffff', '#b3c0aa', 1.3]} />
      <directionalLight
        position={[-3, 7, 4]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <mesh position={[0, -0.065, 0]} receiveShadow>
        <boxGeometry args={[l + 0.06, 0.1, w + 0.06]} />
        <meshStandardMaterial color="#cbd3c7" roughness={0.9} />
        <Edges color="#a2b19f" />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[l, h, w]} />
        <meshBasicMaterial visible={false} />
        <Edges color="#8fa38e" transparent opacity={0.42} />
      </mesh>
      <mesh position={[l / 2, h / 2, 0]}>
        <boxGeometry args={[0.015, h, w]} />
        <meshStandardMaterial
          color="#c8d3c4"
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line
        points={[
          [-l / 2 - 0.02, 0, -doorWidth / 2],
          [-l / 2 - 0.02, doorHeight, -doorWidth / 2],
          [-l / 2 - 0.02, doorHeight, doorWidth / 2],
          [-l / 2 - 0.02, 0, doorWidth / 2],
        ]}
        color="#3e6f55"
        lineWidth={2.5}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.125, 0]}
        receiveShadow
      >
        <planeGeometry args={[30, 30]} />
        <shadowMaterial transparent opacity={0.12} />
      </mesh>
      <gridHelper
        args={[16, 32, '#cdd6c9', '#dce2d8']}
        position={[0, -0.13, 0]}
      />
      {placed
        .filter((p) => !hidden.includes(p.id))
        .map((item) => (
          <CargoBox
            key={`${item.id}-${item.x}-${item.y}-${item.z}`}
            item={item}
            vehicle={vehicle}
            selected={selectedId === item.id}
            onSelect={onSelect}
            labels={labels}
            byStop={byStop}
            unloaded={simulation?.unloadedIds?.includes(item.id)}
            unloadDelay={
              Math.max(0, simulation?.lastStopOrder?.indexOf(item.id) ?? 0) *
              0.55
            }
            ready={simulation?.readyIds?.includes(item.id)}
            miniature={miniature}
          />
        ))}
      {!miniature && (
        <CargoLabel
          text="← REAR DOOR"
          position={[-l / 2 - 0.65, 0.1, 0.05]}
          width={0.75}
        />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={2}
        maxDistance={17}
        maxPolarAngle={Math.PI / 2.02}
        target={[0, h * 0.32, 0]}
      />
    </>
  );
}

export default function CargoViewer({
  vehicle,
  result,
  selectedId,
  onSelect,
  hidden = [],
  simulation = null,
  miniature = false,
}) {
  const [labels, setLabels] = useState(false);
  const [byStop, setByStop] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const stops = [...new Set((result?.placed ?? []).map((p) => p.stop))].sort(
    (a, b) => a - b,
  );
  return (
    <div
      className={`cargo-viewer ${miniature ? 'miniature' : ''} ${expanded ? 'expanded' : ''}`}
    >
      {!miniature && (
        <div className="viewer-top">
          <span>
            <i /> LIVE 3D VIEW <em>cm</em>
          </span>
          <div>
            <button
              aria-label="Reset camera"
              title="Reset camera"
              onClick={() => setResetKey((v) => v + 1)}
            >
              <Icon name="reset" size={16} />
            </button>
            <button
              aria-label={expanded ? 'Close expanded viewer' : 'Expand viewer'}
              title="Expand viewer"
              onClick={() => setExpanded(!expanded)}
            >
              <Icon name={expanded ? 'close' : 'expand'} size={16} />
            </button>
          </div>
        </div>
      )}
      <ViewerBoundary>
        <Suspense
          fallback={
            <div className="viewer-fallback">Preparing the cargo view…</div>
          }
        >
          <Canvas
            shadows
            dpr={[1, 1.7]}
            camera={{ fov: 38, near: 0.1, far: 100, position: [-5, 3, 5] }}
            onPointerMissed={() => onSelect?.(null)}
          >
            <Scene
              vehicle={vehicle}
              placed={result?.placed ?? []}
              selectedId={selectedId}
              onSelect={onSelect}
              labels={labels}
              byStop={byStop}
              hidden={hidden}
              simulation={simulation}
              resetKey={resetKey}
              miniature={miniature}
            />
          </Canvas>
        </Suspense>
      </ViewerBoundary>
      {!miniature && (
        <>
          <div className="viewer-tools">
            <button
              className={labels ? 'is-on' : ''}
              onClick={() => setLabels(!labels)}
            >
              <span className="label-icon">Aa</span> Labels
            </button>
            <button
              className={byStop ? 'is-on' : ''}
              onClick={() => setByStop(!byStop)}
            >
              <Icon name="layers" size={15} /> By delivery stop
            </button>
          </div>
          <div className="viewer-help">
            Drag to orbit <span>·</span> Scroll to zoom <span>·</span>{' '}
            Right-drag to pan
          </div>
        </>
      )}
      <div className="stop-legend">
        {stops.map((stop) => (
          <span key={stop}>
            <i
              style={{ background: byStop ? colorForStop(stop) : '#9faf9a' }}
            />{' '}
            Stop {String(stop).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}
