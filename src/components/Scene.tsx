"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

interface Message {
  id: number;
  content: string;
  x: number;
  z: number;
}

interface SceneProps {
  messages: Message[];
  onSelectMessage: (content: string) => void;
}

function FloatingBottle({ 
  position, 
  content, 
  onClick 
}: { 
  position: [number, number, number]; 
  content: string;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      // gentle floating bob based on x coordinate offset
      meshRef.current.position.y = position[1] + Math.sin(time + position[0]) * 0.12;
      meshRef.current.rotation.z = Math.sin(time * 0.5) * 0.08;
      meshRef.current.rotation.y = time * 0.03;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={onClick}
    >
      <cylinderGeometry args={[0.12, 0.12, 0.5, 8]} />
      <meshStandardMaterial
        color={hovered ? "#38bdf8" : "#0ea5e9"}
        emissive={hovered ? "#0ea5e9" : "#0284c7"}
        emissiveIntensity={hovered ? 1.5 : 0.4}
        roughness={0.1}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function OceanWaves() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      const geometry = meshRef.current.geometry as THREE.BufferGeometry;
      const positionAttribute = geometry.attributes.position;
      
      for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const z = Math.sin(x * 0.5 + time) * 0.12 + Math.cos(y * 0.5 + time) * 0.12;
        positionAttribute.setZ(i, z);
      }
      positionAttribute.needsUpdate = true;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
      <planeGeometry args={[30, 30, 32, 32]} />
      <meshStandardMaterial color="#031e30" flatShading roughness={0.7} />
    </mesh>
  );
}

export default function Scene({ messages, onSelectMessage }: SceneProps) {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 4, 7], fov: 50 }}>
        <ambientLight intensity={0.15} />
        <directionalLight position={[5, 8, 5]} intensity={0.6} color="#93c5fd" />
        <pointLight position={[0, 2, 3]} intensity={0.8} color="#0ea5e9" />
        
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
        
        <OceanWaves />
        
        {messages.map((msg) => (
          <FloatingBottle
            key={msg.id}
            position={[msg.x, 0, msg.z]}
            content={msg.content}
            onClick={() => onSelectMessage(msg.content)}
          />
        ))}
        
        <OrbitControls maxPolarAngle={Math.PI / 2.15} minDistance={3} maxDistance={12} />
      </Canvas>
    </div>
  );
}