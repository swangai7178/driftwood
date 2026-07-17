"use client";

import React, { useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sun, CloudLightning, Anchor } from "lucide-react";

// ==========================================
// 1. GERSTNER WAVE CONFIGURATION & SHADER MATH
// ==========================================
interface GerstnerWaveConfig {
  direction: THREE.Vector2;
  steepness: number;
  wavelength: number;
  speed: number;
}

function calculateGerstnerWave(
  x: number, 
  z: number, 
  time: number, 
  storm: number
) {
  let p = new THREE.Vector3(x, 0, z);
  let tangent = new THREE.Vector3(1, 0, 0);
  let binormal = new THREE.Vector3(0, 0, 1);

  // Dynamic wave scaling based on storm intensity slider
  const waves: GerstnerWaveConfig[] = [
    { direction: new THREE.Vector2(1.0, 0.2).normalize(), steepness: 0.25 + storm * 0.2, wavelength: 5.0 + storm * 2, speed: 1.2 + storm * 1.5 },
    { direction: new THREE.Vector2(0.3, 0.9).normalize(), steepness: 0.15 + storm * 0.15, wavelength: 2.5, speed: 2.0 + storm * 1.0 },
    { direction: new THREE.Vector2(-0.6, 0.4).normalize(), steepness: 0.1, wavelength: 1.2, speed: 0.8 }
  ];

  let totalSteepness = 0;

  waves.forEach((w) => {
    const k = (2 * Math.PI) / w.wavelength;
    const c = Math.sqrt(9.81 / k) * w.speed;
    const dotProd = w.direction.x * x + w.direction.y * z;
    const phase = k * (dotProd - c * time);
    const a = w.steepness / k;

    // Trochoidal horizontal sharpening displacement vectors
    p.x += w.direction.x * (a * Math.cos(phase));
    p.z += w.direction.y * (a * Math.cos(phase));
    p.y += a * Math.sin(phase);

    // Derivatives for normal vector calculations and crest tracking
    tangent.x -= w.direction.x * w.direction.x * (w.steepness * Math.sin(phase));
    tangent.y += w.direction.x * (w.steepness * Math.cos(phase));
    tangent.z -= w.direction.x * w.direction.y * (w.steepness * Math.sin(phase));

    binormal.x -= w.direction.x * w.direction.y * (w.steepness * Math.sin(phase));
    binormal.y += w.direction.y * (w.steepness * Math.cos(phase));
    binormal.z -= w.direction.y * w.direction.y * (w.steepness * Math.sin(phase));

    totalSteepness += Math.abs(Math.sin(phase));
  });

  const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();
  
  return { 
    position: p, 
    normal, 
    steepnessFactor: totalSteepness / waves.length 
  };
}

// ==========================================
// 2. PROCEDURAL HIGH-FIDELITY OCEAN MESH
// ==========================================
function GerstnerOceanMesh({ stormIntensity, timeOfDay }: { stormIntensity: number; timeOfDay: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Dynamic environment profile color interpolation maps
  const getWaterColors = () => {
    if (timeOfDay > 0.6 && timeOfDay < 0.8) {
      // Sunset Profile
      return { deep: "#061324", shallow: "#1a425a", emissive: "#cc5200" };
    } else if (timeOfDay >= 0.8 || timeOfDay <= 0.3) {
      // Midnight Profile
      return { deep: "#010408", shallow: "#081626", emissive: "#000000" };
    }
    // Midday Profile
    return { deep: "#022135", shallow: "#0d5c75", emissive: "#02121a" };
  };

  const colors = getWaterColors();

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const geom = meshRef.current.geometry;
    const posAttr = geom.attributes.position;
    const normAttr = geom.attributes.normal;

    const initialPos = geom.userData.initialPositions || [];
    if (initialPos.length === 0) {
      for (let i = 0; i < posAttr.count; i++) {
        initialPos.push(new THREE.Vector2(posAttr.getX(i), posAttr.getZ(i)));
      }
      geom.userData.initialPositions = initialPos;
    }

    for (let i = 0; i < posAttr.count; i++) {
      const orig = initialPos[i];
      const { position, normal } = calculateGerstnerWave(orig.x, orig.y, time, stormIntensity);
      
      posAttr.setXYZ(i, position.x, position.y, position.z);
      normAttr.setXYZ(i, normal.x, normal.y, normal.z);
    }

    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[60, 60, 80, 80]} />
      <meshPhysicalMaterial
        color={colors.shallow}
        emissive={colors.emissive}
        emissiveIntensity={timeOfDay > 0.6 && timeOfDay < 0.8 ? 0.4 : 0.1}
        roughness={0.04}
        metalness={0.1}
        transmission={0.6}
        thickness={2.0}
        clearcoat={1.0}
        clearcoatRoughness={0.02}
        transparent
        opacity={0.97}
      />
    </mesh>
  );
}

// ==========================================
// 3. PHYSICAL GLASS BOTTLE WITH SLOSHING FLUID
// ==========================================
function AdvancedPhysicalBottle({ stormIntensity }: { stormIntensity: number }) {
  const bottleGroup = useRef<THREE.Group>(null);
  const fluidMesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!bottleGroup.current || !fluidMesh.current) return;
    const time = state.clock.getElapsedTime();

    const { position, normal } = calculateGerstnerWave(0, 0, time, stormIntensity);
    
    bottleGroup.current.position.set(0, position.y - 0.05, 0);

    // Apply pitch rotations matching wave normal vectors
    const targetRotationX = Math.atan2(normal.y, normal.z) - Math.PI / 2;
    const targetRotationZ = -Math.atan2(normal.x, normal.y);
    
    bottleGroup.current.rotation.x = THREE.MathUtils.lerp(bottleGroup.current.rotation.x, targetRotationX, 0.1);
    bottleGroup.current.rotation.z = THREE.MathUtils.lerp(bottleGroup.current.rotation.z, targetRotationZ, 0.1);
    bottleGroup.current.rotation.y = time * 0.15; 

    // Internal Sloshing Liquid Vector Calculation
    const fluidSlosh = Math.sin(time * 3.0) * 0.15 * (1.0 + stormIntensity);
    fluidMesh.current.rotation.z = fluidSlosh;
  });

  return (
    <group ref={bottleGroup}>
      {/* Outer Heavy Refractive Glass Flagon Envelope */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.15, 0.16, 0.6, 24]} />
        <meshPhysicalMaterial 
          color="#bfe3dd" 
          transmission={0.98} 
          thickness={0.25} 
          roughness={0.01} 
          clearcoat={1.0}
          transparent
        />
      </mesh>

      {/* Internal Sloshing Liquid Volume Mesh */}
      <mesh ref={fluidMesh} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.13, 0.14, 0.3, 16]} />
        <meshStandardMaterial 
          color="#dfa837" 
          roughness={0.2} 
          transparent 
          opacity={0.8} 
        />
      </mesh>

      {/* Tapered Bottle Neck */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.06, 0.15, 0.15, 24]} />
        <meshPhysicalMaterial color="#bfe3dd" transmission={0.95} thickness={0.1} roughness={0.01} />
      </mesh>

      {/* Weathered Wooden Stopper Cork */}
      <mesh position={[0, 0.64, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.08, 12]} />
        <meshStandardMaterial color="#7a583a" roughness={0.85} />
      </mesh>

      {/* Hidden Parchment Scroll Element */}
      <mesh position={[0, 0.25, 0]} rotation={[0.2, 0.5, -0.1]}>
        <cylinderGeometry args={[0.05, 0.05, 0.35, 12]} />
        <meshStandardMaterial color="#ebdcb9" roughness={0.7} />
      </mesh>
    </group>
  );
}

// ==========================================
// 4. MAIN USER INTERFACE CORE COMPONENT
// ==========================================
export default function UltimateOceanScene() {
  const [timeOfDay, setTimeOfDay] = useState<number>(0.7); 
  const [stormIntensity, setStormIntensity] = useState<number>(0.2);

  const getSkyGradient = () => {
    if (timeOfDay > 0.6 && timeOfDay < 0.8) {
      return "from-[#ff512f] via-[#f09819] to-[#2b1055]"; 
    } else if (timeOfDay >= 0.8 || timeOfDay <= 0.3) {
      return "from-[#020208] via-[#0b112c] to-[#000000]"; 
    }
    return "from-[#2980b9] via-[#6dd5fa] to-[#ffffff]"; 
  };

  return (
    <main className={`relative h-screen w-screen overflow-hidden bg-gradient-to-b ${getSkyGradient()} text-white`}>
      <div className="absolute inset-0 w-full h-full z-0">
        <Canvas camera={{ position: [0, 2.2, 4.5], fov: 45 }}>
          <ambientLight intensity={timeOfDay > 0.7 ? 0.15 : 0.6} color="#ffebcc" />
          
          <directionalLight 
            position={[0, 2, -10]} 
            intensity={timeOfDay > 0.6 && timeOfDay < 0.8 ? 2.5 : 0.5} 
            color="#ffaa44" 
          />

          <GerstnerOceanMesh stormIntensity={stormIntensity} timeOfDay={timeOfDay} />
          <AdvancedPhysicalBottle stormIntensity={stormIntensity} />
        </Canvas>
      </div>

      {/* HEADER HUD */}
      <div className="absolute top-6 left-6 z-30 pointer-events-none select-none">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-sm tracking-[0.25em] font-extrabold uppercase flex items-center gap-1.5 drop-shadow-md">
            <Anchor className="w-4 h-4 text-orange-300" />
            Driftwood & Whispers Engine
          </h1>
          <p className="text-[10px] tracking-wider font-bold text-orange-200/80">
            Procedural Shaders & Internal Slosh Architecture Active
          </p>
        </div>
      </div>

      {/* FLOATING CONTROL PANEL */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full px-4 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-5 shadow-2xl space-y-4">
          
          {/* Time System Controller */}
          <div className="flex items-center gap-4">
            <Sun className="w-4 h-4 text-orange-400" />
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-bold tracking-wider text-slate-300 mb-1">
                <span>Time of Day Matrix</span>
                <span>{timeOfDay === 0.7 ? "Sunset Profile" : `${Math.floor(timeOfDay * 24)}:00h`}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-orange-400"
              />
            </div>
          </div>

          {/* Gerstner Wave Sharpness Multiplier System */}
          <div className="flex items-center gap-4">
            <CloudLightning className="w-4 h-4 text-cyan-400" />
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-bold tracking-wider text-slate-300 mb-1">
                <span>Wave Sharpness Profile</span>
                <span>{Math.floor(stormIntensity * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={stormIntensity}
                onChange={(e) => setStormIntensity(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}