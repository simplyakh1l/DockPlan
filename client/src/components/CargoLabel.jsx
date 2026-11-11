import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// A canvas-texture sprite stays inside Three's scene. Unlike an HTML overlay,
// it needs no additional React DOM root when cargo or routes unmount.
export default function CargoLabel({
  text,
  caption = '',
  position,
  selected = false,
  width = 0.55,
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = selected ? '#fff6d9' : '#f7faef';
    ctx.fillRect(2, 2, 316, 96);
    ctx.strokeStyle = selected ? '#bd9e48' : '#becfb0';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 316, 96);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#506a43';
    ctx.font = '600 23px sans-serif';
    ctx.fillText(String(text).slice(0, 22), 160, caption ? 43 : 59, 296);
    if (caption) {
      ctx.fillStyle = '#8c9d7b';
      ctx.font = '500 15px sans-serif';
      ctx.fillText(caption, 160, 76, 296);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [text, caption, selected]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite
      position={position}
      scale={[width, (width * 100) / 320, 1]}
      renderOrder={10}
    >
      <spriteMaterial
        map={texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
