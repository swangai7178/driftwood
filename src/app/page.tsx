/*
 * Copyright (c) 2026 
 * All rights reserved.
 */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Plus, X, Volume2, VolumeX, Loader2, Anchor, RefreshCw, BookOpen, Bookmark, Trash2 } from "lucide-react";

interface Message {
  id: number;
  content: string;
  x: number;
  y: number;
  z: number;
  created_at: string;
  isNew?: boolean;
}

const PROFANITY_FILTER = ["toxic", "abuse", "spam", "hate", "kill", "threat"];

// ==========================================
// 1. RE-ENGINEERED HIGH-FIDELITY DROP SYNTH
// ==========================================
class OceanAudioSystem {
  private ctx: AudioContext | null = null;
  private filter: BiquadFilterNode | null = null;
  private lfo: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  start() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 400;
    this.filter.Q.value = 1.0;

    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.value = 0.1;
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180; 

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.12;

    this.lfo.connect(lfoGain);
    lfoGain.connect(this.filter.frequency);
    whiteNoise.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.ctx.destination);

    whiteNoise.start();
    this.lfo.start();
  }

  stop() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  updateSpatialSound(isZoomed: boolean) {
    if (!this.gain || !this.filter) return;
    const targetGain = isZoomed ? 0.28 : 0.12;
    const targetFreq = isZoomed ? 550 : 380;
    this.gain.gain.setTargetAtTime(targetGain, this.ctx!.currentTime, 0.4);
    this.filter.frequency.setTargetAtTime(targetFreq, this.ctx!.currentTime, 0.4);
  }

  playSplashSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(450, now);
    osc1.frequency.exponentialRampToValueAtTime(950, now + 0.15);
    
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.08);
    
    gain2.gain.setValueAtTime(0.12, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    const dropFilter = this.ctx.createBiquadFilter();
    dropFilter.type = "bandpass";
    dropFilter.frequency.setValueAtTime(1400, now);
    dropFilter.Q.setValueAtTime(3.0, now);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    
    osc2.connect(dropFilter);
    dropFilter.connect(gain2);
    gain2.connect(this.ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.16);
    osc2.stop(now + 0.09);
  }
}

const oceanSynth = typeof window !== "undefined" ? new OceanAudioSystem() : null;

const globalActiveRipples: Array<{ x: number; z: number; time: number }> = [];

// A global reference tracking the real-time position of all bottles for fast collision comparisons
const globalBottlePositions: Map<number, THREE.Vector3> = new Map();

// ==========================================
// 2. STEEP TROCHOIDAL GERSTNER WAVE SYSTEM
// ==========================================
interface GerstnerWaveConfig {
  direction: THREE.Vector2;
  steepness: number;
  wavelength: number;
  speed: number;
}

const WAVES: GerstnerWaveConfig[] = [
  { direction: new THREE.Vector2(1.0, 0.2).normalize(), steepness: 0.35, wavelength: 4.5, speed: 1.4 },
  { direction: new THREE.Vector2(0.3, 0.9).normalize(), steepness: 0.25, wavelength: 2.2, speed: 2.1 },
  { direction: new THREE.Vector2(-0.6, 0.4).normalize(), steepness: 0.15, wavelength: 1.2, speed: 0.9 },
];

function calculateGerstnerWave(x: number, y: number, time: number): { position: THREE.Vector3; normal: THREE.Vector3; crestFactor: number } {
  let p = new THREE.Vector3(x, y, 0);
  let tangent = new THREE.Vector3(1, 0, 0);
  let binormal = new THREE.Vector3(0, 1, 0);
  let totalCrest = 0;

  WAVES.forEach((w) => {
    const k = (2 * Math.PI) / w.wavelength;
    const c = Math.sqrt(9.81 / k) * w.speed;
    const d = w.direction;
    const dotProd = d.x * x + d.y * y;
    const phase = k * (dotProd - c * time);
    
    const a = w.steepness / k;

    p.x += d.x * (a * Math.cos(phase));
    p.y += d.y * (a * Math.cos(phase));
    p.z += a * Math.sin(phase);

    tangent.x -= d.x * d.x * (w.steepness * Math.sin(phase));
    tangent.y -= d.x * d.y * (w.steepness * Math.sin(phase));
    tangent.z += d.x * (w.steepness * Math.cos(phase));

    binormal.x -= d.x * d.y * (w.steepness * Math.sin(phase));
    binormal.y -= d.y * d.y * (w.steepness * Math.sin(phase));
    binormal.z += d.y * (w.steepness * Math.sin(phase));

    totalCrest += Math.sin(phase);
  });

  const normal = new THREE.Vector3().crossVectors(tangent, binormal).normalize();
  const crestFactor = (totalCrest / WAVES.length + 1) / 2;

  return { position: p, normal, crestFactor };
}

function GerstnerOceanMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const geom = meshRef.current.geometry;
    const posAttr = geom.attributes.position;
    const normAttr = geom.attributes.normal;
    
    if (!geom.userData.initialPositions) {
      const initialPos = [];
      for (let i = 0; i < posAttr.count; i++) {
        initialPos.push(new THREE.Vector2(posAttr.getX(i), posAttr.getY(i)));
      }
      geom.userData.initialPositions = initialPos;
    }
    const initialPos = geom.userData.initialPositions;

    let accumulatedCrest = 0;

    for (let i = 0; i < posAttr.count; i++) {
      const orig = initialPos[i];
      const { position, normal, crestFactor } = calculateGerstnerWave(orig.x, orig.y, time);
      
      let finalZ = position.z;
      accumulatedCrest += crestFactor;

      for (let j = 0; j < globalActiveRipples.length; j++) {
        const rip = globalActiveRipples[j];
        const dist = Math.sqrt(Math.pow(position.x - rip.x, 2) + Math.pow(position.y - rip.z, 2));
        const timeElapsed = time - rip.time;
        
        if (timeElapsed > 0 && timeElapsed < 2.5) {
          const waveFront = dist - timeElapsed * 2.2;
          if (Math.abs(waveFront) < 0.5) {
            const fade = Math.max(0, 1.0 - timeElapsed / 2.5) * Math.max(0, 1.0 - dist / 8);
            finalZ += Math.sin(dist * 7.0 - timeElapsed * 15.0) * 0.12 * fade;
          }
        }
      }

      posAttr.setXYZ(i, position.x, position.y, finalZ);
      normAttr.setXYZ(i, normal.x, normal.y, normal.z);
    }
    
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;

    geom.computeBoundingBox();
    geom.computeBoundingSphere();

    if (matRef.current) {
      const averageCrest = accumulatedCrest / posAttr.count;
      matRef.current.roughness = THREE.MathUtils.lerp(0.02, 0.18, averageCrest);
      matRef.current.clearcoatRoughness = THREE.MathUtils.lerp(0.01, 0.08, averageCrest);
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[60, 60, 96, 96]} />
      <meshPhysicalMaterial 
        ref={matRef}
        color="#083852" 
        emissive="#021c3a" 
        roughness={0.03} 
        metalness={0.2}
        transmission={0.4}
        thickness={2.5}
        clearcoat={1.0}
        clearcoatRoughness={0.02}
        transparent
        opacity={0.96}
        flatShading={false}
      />
    </mesh>
  );
}

// ==========================================
// 3. PHYSICAL BOTTLE STRUCTURAL DESIGN
// ==========================================
interface BottleProps {
  message: Message;
  index: number;
  focusedId: number | null;
  onFocus: (msg: Message) => void;
}

function PhysicalBottle({ message, index, focusedId, onFocus }: BottleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const isTarget = focusedId === message.id;
  
  const physics = useRef({
    posX: message.x,
    posY: message.isNew ? 6.0 : 0.0,
    posZ: message.z,
    velY: message.isNew ? -0.15 : 0,
    driftOffsetX: 0, // Drifting shifts caused by collisions
    driftOffsetZ: 0,
    hasSplashed: !message.isNew,
    isReturning: false,
    returnProgress: 0.0,
  });

  const lastIsTarget = useRef(isTarget);

  useFrame((state) => {
    if (!groupRef.current || !innerRef.current) return;
    const time = state.clock.getElapsedTime();

    // Collision Separation System Setup
    const currentX = physics.current.posX + physics.current.driftOffsetX;
    const currentZ = physics.current.posZ + physics.current.driftOffsetZ;
    const bottleRadius = 0.14; // Diameter threshold bounds matches geometric meshes

    // Scan global coordinate registry for nearby intersections
    globalBottlePositions.forEach((pos, id) => {
      if (id !== message.id) {
        const dx = currentX - pos.x;
        const dz = currentZ - pos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const minDistance = bottleRadius * 2;

        if (distance < minDistance && distance > 0) {
          // Calculate separation force vector direction
          const overlap = minDistance - distance;
          const forceX = (dx / distance) * overlap * 0.15;
          const forceZ = (dz / distance) * overlap * 0.15;

          // Push bottle targets dynamically out of interception bounds
          physics.current.driftOffsetX += forceX;
          physics.current.driftOffsetZ += forceZ;

          // Play a tiny subtle water clink splash sound when they touch
          if (time % 2.0 < 0.02 && oceanSynth) {
            oceanSynth.playSplashSound();
          }
        }
      }
    });

    // Bring ambient drift slowly back into orbital equilibrium path lines
    physics.current.driftOffsetX = THREE.MathUtils.lerp(physics.current.driftOffsetX, 0, 0.01);
    physics.current.driftOffsetZ = THREE.MathUtils.lerp(physics.current.driftOffsetZ, 0, 0.01);

    const resolvedX = physics.current.posX + physics.current.driftOffsetX;
    const resolvedZ = physics.current.posZ + physics.current.driftOffsetZ;

    if (!physics.current.hasSplashed) {
      physics.current.velY -= 0.012; 
      physics.current.posY += physics.current.velY;
      
      const waveState = calculateGerstnerWave(resolvedX, resolvedZ, time);
      if (physics.current.posY <= waveState.position.z) {
        physics.current.posY = waveState.position.z;
        physics.current.velY = 0;
        physics.current.hasSplashed = true;
        if (oceanSynth) oceanSynth.playSplashSound();
        globalActiveRipples.push({ x: resolvedX, z: resolvedZ, time });
      }
    } 
    else if (physics.current.isReturning) {
      physics.current.returnProgress += 0.045;
      const waveState = calculateGerstnerWave(resolvedX, resolvedZ, time);
      
      if (physics.current.returnProgress >= 1.0) {
        physics.current.returnProgress = 1.0;
        physics.current.isReturning = false;
        physics.current.posY = waveState.position.z;
        if (oceanSynth) oceanSynth.playSplashSound();
        globalActiveRipples.push({ x: resolvedX, z: resolvedZ, time });
      } else {
        const t = physics.current.returnProgress;
        const smoothT = t * t * (3 - 2 * t);
        physics.current.posY = THREE.MathUtils.lerp(0.68, waveState.position.z, smoothT);
        physics.current.posX = THREE.MathUtils.lerp(0.0, message.x, smoothT);
        physics.current.posZ = THREE.MathUtils.lerp(1.2, message.z, smoothT);
      }
    }
    else if (isTarget) {
      physics.current.posX = THREE.MathUtils.lerp(physics.current.posX, 0.0, 0.09);
      physics.current.posY = THREE.MathUtils.lerp(physics.current.posY, 0.68, 0.09);
      physics.current.posZ = THREE.MathUtils.lerp(physics.current.posZ, 1.2, 0.09);
    } 
    else {
      // Apply ocean circular tidal drift current vector orbits over time
      const waveState = calculateGerstnerWave(resolvedX, resolvedZ, time);
      
      const microBob = Math.sin(time * 3.5 + index) * 0.015;
      physics.current.posY = waveState.position.z - 0.04 + microBob;

      const targetRotationX = Math.atan2(waveState.normal.y, waveState.normal.z) - Math.PI/2;
      const targetRotationZ = -Math.atan2(waveState.normal.x, waveState.normal.z);
      
      const microSwayX = Math.cos(time * 2.0 + index) * 0.02;
      const microSwayZ = Math.sin(time * 2.5 + index) * 0.02;

      innerRef.current.rotation.x = THREE.MathUtils.lerp(innerRef.current.rotation.x, targetRotationX + microSwayX, 0.1);
      innerRef.current.rotation.z = THREE.MathUtils.lerp(innerRef.current.rotation.z, targetRotationZ + microSwayZ, 0.1);
    }

    groupRef.current.position.set(resolvedX, physics.current.posY, resolvedZ);

    // Broadcast current position vectors to the global coordinate registry map
    globalBottlePositions.set(message.id, groupRef.current.position.clone());

    if (isTarget && !physics.current.isReturning) {
      innerRef.current.rotation.set(0.08, time * 0.2, 0);
    } else if (!isTarget && !physics.current.isReturning) {
      innerRef.current.rotation.y = time * 0.05 + (index * 45);
    }

    if (lastIsTarget.current && !isTarget) {
      physics.current.isReturning = true;
      physics.current.returnProgress = 0.0;
    }
    lastIsTarget.current = isTarget;
  });

  // Clean up registration on component unmount
  useEffect(() => {
    return () => {
      globalBottlePositions.delete(message.id);
    };
  }, [message.id]);

  const isAnyFocused = focusedId !== null;
  const opacity = isAnyFocused ? (isTarget ? 1.0 : 0.05) : 0.95;

  return (
    <group ref={groupRef}>
      <group 
        ref={innerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!physics.current.isReturning) onFocus(message);
        }}
      >
        <mesh position={[0, -0.04, 0]}>
          <cylinderGeometry args={[0.072, 0.076, 0.32, 24]} />
          <meshPhysicalMaterial 
            color="#a3d2ca" 
            transmission={0.96} 
            thickness={0.16} 
            roughness={0.02} 
            transparent
            opacity={opacity}
            clearcoat={1.0}
            emissive={isTarget ? "#ff9a3c" : "#000000"}
            emissiveIntensity={isTarget ? 0.25 : 0}
          />
        </mesh>
        
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.028, 0.072, 0.07, 24]} />
          <meshPhysicalMaterial color="#a3d2ca" transmission={0.96} roughness={0.02} transparent opacity={opacity} clearcoat={1.0} />
        </mesh>

        <mesh position={[0, 0.20, 0]}>
          <cylinderGeometry args={[0.024, 0.028, 0.06, 18]} />
          <meshPhysicalMaterial color="#a3d2ca" transmission={0.96} roughness={0.02} transparent opacity={opacity} clearcoat={1.0} />
        </mesh>
        
        <mesh position={[0, 0.232, 0]}>
          <torusGeometry args={[0.022, 0.006, 8, 16]} />
          <meshPhysicalMaterial color="#a3d2ca" transmission={0.96} transparent opacity={opacity} />
        </mesh>
        
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.016, 0.02, 0.035, 12]} />
          <meshStandardMaterial color="#8c6d4f" roughness={0.9} transparent opacity={opacity} />
        </mesh>
        
        <mesh position={[0, -0.01, 0]} rotation={[0, 0.6, 0.1]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 12]} />
          <meshStandardMaterial color="#f0e5c9" roughness={0.75} transparent opacity={opacity} />
        </mesh>
      </group>
    </group>
  );
}

// ==========================================
// 4. STATIONARY RENDER SPECTRAL CAMERA SYSTEM
// ==========================================
function CameraRig({ focusedMessage }: { focusedMessage: Message | null }) {
  const { camera } = useThree();

  useFrame(() => {
    let targetX = 0, targetY = 1.8, targetZ = 3.8;
    let lookTarget = new THREE.Vector3(0, 0.1, 0);

    if (focusedMessage) {
      targetX = 0;
      targetY = 0.88;
      targetZ = 2.0;
      lookTarget.set(0, 0.68, 1.2);
    }

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.06);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.06);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.06);

    const currentLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    camera.lookAt(currentLook.lerp(lookTarget, 0.06));
  });

  return null;
}

// ==========================================
// 5. MAIN INTEGRATED COMPONENT LAYOUT
// ==========================================
export default function MessageInABottle() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [casting, setCasting] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [focusedMessage, setFocusedMessage] = useState<Message | null>(null);
  const [moderationError, setModerationError] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("whispers_notebook");
    if (stored) setSavedNotes(JSON.parse(stored));
  }, []);

  const fetchMessages = async (newAddedId?: number) => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        const mapped: Message[] = data.map((msg: any, idx: number) => {
          // Give them randomized orbital paths so they naturally float past each other and collide
          const angle = (idx / data.length) * Math.PI * 2;
          const radius = 0.8 + (idx % 3) * 0.6;
          return {
            ...msg,
            x: Math.cos(angle) * radius,
            z: Math.sin(angle) * radius,
            isNew: msg.id === newAddedId,
          };
        });
        setMessages(mapped);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    if (oceanSynth && isAudioPlaying) {
      oceanSynth.updateSpatialSound(focusedMessage !== null);
    }
  }, [focusedMessage, isAudioPlaying]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const box = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    cardRef.current.style.transform = `perspective(1000px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg) translateY(-2px)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
  };

  const castMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setModerationError("");
    const cleanedText = newMessage.toLowerCase();

    if (PROFANITY_FILTER.some((term) => cleanedText.includes(term))) {
      setModerationError("The sea prefers quieter, gentler thoughts.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });

      if (res.ok) {
        const casted = await res.json();
        setNewMessage("");
        setCasting(false);
        fetchMessages(casted.id); 
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const saveToNotebook = (note: string) => {
    const updated = [...savedNotes, note];
    setSavedNotes(updated);
    localStorage.setItem("whispers_notebook", JSON.stringify(updated));
  };

  const deleteFromNotebook = (index: number) => {
    const updated = savedNotes.filter((_, idx) => idx !== index);
    setSavedNotes(updated);
    localStorage.setItem("whispers_notebook", JSON.stringify(updated));
  };

  const toggleAudio = () => {
    if (!oceanSynth) return;
    if (isAudioPlaying) {
      oceanSynth.stop();
      setIsAudioPlaying(false);
    } else {
      oceanSynth.start();
      setIsAudioPlaying(true);
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-gradient-to-b from-[#ff5e62] via-[#ff9966] to-[#203a43] text-[#0F1E2C]">
      
      <div className="absolute inset-0 w-full h-full z-0">
        <Canvas>
          <ambientLight intensity={0.5} color="#ffdfb4" />
          <directionalLight position={[0, 4, -15]} intensity={2.2} color="#ffdbb5" />
          <pointLight position={[0, 1.3, 1.2]} intensity={focusedMessage ? 1.5 : 0} color="#ffdfb4" />
          
          <GerstnerOceanMesh />

          {messages.map((msg, index) => (
            <PhysicalBottle 
              key={msg.id} 
              message={msg} 
              index={index} 
              focusedId={focusedMessage ? focusedMessage.id : null}
              onFocus={(msg) => setFocusedMessage(msg)}
            />
          ))}

          <CameraRig focusedMessage={focusedMessage} />
        </Canvas>
      </div>

      <div className="absolute top-6 left-6 z-30 pointer-events-none select-none">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-sm tracking-[0.25em] font-extrabold uppercase flex items-center gap-1.5 text-white drop-shadow-md">
            <Anchor className="w-4 h-4 text-[#ffdfb4]" />
            Driftwood & Whispers
          </h1>
          <p className="text-[10px] tracking-wider font-bold text-orange-200 opacity-90 drop-shadow-sm">
            {messages.length} notes riding the current
          </p>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
        <button
          onClick={() => setNotebookOpen(true)}
          className="p-2.5 rounded-full border border-white/20 bg-black/15 backdrop-blur-md text-white hover:bg-black/25 transition-all shadow-md"
          title="Open Notebook"
        >
          <BookOpen className="w-4 h-4" />
        </button>

        <button
          onClick={toggleAudio}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/20 bg-black/15 backdrop-blur-md text-xs font-bold tracking-wider text-white hover:bg-black/25 transition-all shadow-md"
        >
          {isAudioPlaying ? (
            <>
              <Volume2 className="w-4 h-4 text-orange-200 animate-pulse" />
              <span>Waves active</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-orange-300/60" />
              <span>Mute environment</span>
            </>
          )}
        </button>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-4 w-full px-4 max-w-sm pointer-events-auto">
        {focusedMessage ? (
          <div className="w-full transform transition-all duration-300 ease-out animate-in slide-in-from-bottom-5">
            <div 
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative overflow-hidden rounded-2xl border border-[#DFD3C3] bg-[#FCF8F2] shadow-2xl p-5 transition-transform duration-150 ease-out cursor-default"
            >
              <div className="relative bg-white text-slate-800 p-5 rounded-xl shadow-inner border border-[#E9DAC6] font-serif italic text-sm leading-relaxed max-h-36 overflow-y-auto select-text">
                <div className="absolute inset-0 bg-[radial-gradient(#E9DAC6_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />
                "{focusedMessage.content}"
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => saveToNotebook(focusedMessage.content)}
                  disabled={savedNotes.includes(focusedMessage.content)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-orange-600 disabled:text-emerald-600 disabled:cursor-not-allowed transition-colors"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {savedNotes.includes(focusedMessage.content) ? "Saved" : "Keep"}
                </button>
                
                <button
                  onClick={() => setFocusedMessage(null)}
                  className="flex items-center gap-1 text-[10px] text-orange-700 font-extrabold uppercase tracking-widest hover:text-orange-900 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Toss Back
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCasting(true)}
            className="group flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-xl hover:shadow-orange-500/30 hover:scale-[1.02] transition-all duration-300 text-xs tracking-widest uppercase font-bold text-white active:scale-95"
          >
            <Plus className="w-4 h-4 text-white group-hover:rotate-90 transition-transform duration-300" />
            Cast a Message
          </button>
        )}
      </div>

      {casting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/95 backdrop-blur-md shadow-2xl p-6 transform transition-transform duration-300 scale-100 animate-in zoom-in-95">
            <button onClick={() => setCasting(false)} className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-sm tracking-[0.25em] uppercase font-bold text-[#0F1E2C] mb-1">Seal Your Message</h2>
            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">Whisper your thoughts to the tide. Once sealed, your bottle will drop down dynamically into the crashing ocean swells.</p>

            <form onSubmit={castMessage} className="space-y-3">
              <div className="relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type something beautiful..."
                  maxLength={280}
                  rows={4}
                  required
                  className="w-full resize-none rounded-xl border border-[#DFD3C3] bg-[#FCF8F2] p-4 text-xs text-[#0F1E2C] placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400/30 transition-all duration-200"
                />
                <span className="absolute bottom-3 right-3 text-[9px] text-slate-400 font-bold tracking-wider">{newMessage.length}/280</span>
              </div>

              {moderationError && <p className="text-[10px] font-semibold text-rose-600 animate-pulse">{moderationError}</p>}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setCasting(false)} className="px-4 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest text-slate-400 hover:text-slate-600">Discard</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-md"
                >
                  {submitting ? (<><Loader2 className="w-3 h-3 animate-spin" />Sealing...</>) : "Cast Out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {notebookOpen && (
        <div className="absolute inset-y-0 right-0 w-full max-w-sm z-50 bg-[#FCF8F2]/95 backdrop-blur-md border-l border-[#DFD3C3] shadow-2xl p-6 flex flex-col transform transition-transform duration-300 animate-in slide-in-from-right">
          <div className="flex items-center justify-between border-b border-[#DFD3C3]/60 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-orange-700" />
              <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-[#0F1E2C]">Found Whispers</h3>
            </div>
            <button onClick={() => setNotebookOpen(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {savedNotes.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center italic mt-12">No keeping logs yet. Fish out bottles to keep notes.</p>
            ) : (
              savedNotes.map((note, index) => (
                <div key={index} className="relative group bg-white border border-[#E9DAC6] rounded-xl p-4 shadow-sm font-serif italic text-xs leading-relaxed text-slate-700">
                  <button 
                    onClick={() => deleteFromNotebook(index)}
                    className="absolute top-3 right-3 p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  "{note}"
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </main>
  );
}