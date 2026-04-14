"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  state?: 'idle' | 'searching' | 'result';
  size?: number;
}

export function ZenoBrainOrb({ state = 'idle', size = 250 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>(0);
  const targetRef = useRef({ activeTarget: 0.0 });

  const vertShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragShader = `
    uniform float uTime;
    uniform float uActive;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    // Perlin 3D Noise map
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857; 
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vec3 n = normalize(vNormal);
      vec3 v = normalize(vViewPosition);

      // Core color of the sphere (deep volumetric blue)
      vec3 coreColor = vec3(0.01, 0.04, 0.12);
      vec3 color = coreColor;

      // Calculate noise field for flowing dynamics
      vec3 noisePos = n * 2.0 + vec3(0.0, uTime * 0.4, uTime * 0.2);
      float displacement = snoise(noisePos);

      // Speed up animation when searching
      float speed = uTime * (1.5 + uActive * 2.0);

      // Primary ribbon (thick cyan wave)
      float wave1 = sin(n.y * 6.0 + n.x * 4.0 + speed + displacement * 2.5);
      float ribbon1 = smoothstep(0.88, 1.0, wave1); // sharper edge

      // Secondary ribbon (thinner, faster)
      float wave2 = sin(n.z * 5.0 - n.y * 5.0 - speed * 1.2 + displacement * 3.0);
      float ribbon2 = smoothstep(0.92, 1.0, wave2);

      vec3 cyanGlow = vec3(0.1, 0.65, 1.0);
      vec3 whiteHot = vec3(1.0, 1.0, 1.0);

      // Blend ribbons into volumetric color
      color += mix(cyanGlow, whiteHot, ribbon1) * ribbon1 * 1.8;
      color += mix(cyanGlow, whiteHot, ribbon2) * ribbon2 * 1.2;

      // Fresnel Rim effect (glassy edge)
      float fresnel = clamp(1.0 - dot(n, v), 0.0, 1.0);
      float rim = pow(fresnel, 3.0);
      color += vec3(0.0, 0.3, 0.8) * rim * 1.2;

      // Strong specular highlight bottom-right as seen in the reference image
      vec3 lightDir = normalize(vec3(0.8, -1.0, 1.0));
      float specular = pow(max(dot(n, lightDir), 0.0), 12.0);
      color += whiteHot * specular * 1.5;

      // Alpha rendering: make dark areas slightly transparent so it feels like energy wrapping a void
      float alpha = 0.8 + ribbon1 * 0.2 + ribbon2 * 0.2 + rim * 0.2;

      gl_FragColor = vec4(color, min(alpha, 1.0));
    }
  `;

  useEffect(() => {
    if (!mountRef.current) return;

    const canvasWidth = size;
    const canvasHeight = size;
    
    // Check if there's already a canvas, remove it if so
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvasWidth, canvasHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, canvasWidth / canvasHeight, 0.1, 100);
    camera.position.z = 3.0;

    const uniforms = {
      uTime:   { value: 0 },
      uActive: { value: 0 }
    };

    const geometry = new THREE.SphereGeometry(1, 128, 128);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      uniforms,
      transparent: true,
    });

    const orb = new THREE.Mesh(geometry, material);
    scene.add(orb);

    const clock = new THREE.Clock();

    (orb as any).zenoUniforms = uniforms;
    scene.userData.orbRef = orb;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      const o = scene.userData.orbRef as any;
      if (o) {
        o.zenoUniforms.uActive.value += (targetRef.current.activeTarget - o.zenoUniforms.uActive.value) * dt * 2.0;
        o.zenoUniforms.uTime.value = t;

        o.rotation.y += 0.002;
        o.rotation.z += 0.001;
      }

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [size, fragShader, vertShader]);

  useEffect(() => {
    if (state === 'idle') {
      targetRef.current.activeTarget = 0.0;
    } else if (state === 'searching') {
      targetRef.current.activeTarget = 1.0;
    } else if (state === 'result') {
      targetRef.current.activeTarget = 0.3; // Slight hum for result
    }
  }, [state]);

  return (
    <div 
      className="relative flex items-center justify-center orb-component pointer-events-none transition-transform duration-700 ease-out" 
      ref={mountRef}
      style={{ width: size, height: size }}
    />
  );
}
