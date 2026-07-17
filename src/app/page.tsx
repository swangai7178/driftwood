"use client";

import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Plus, X, Volume2, VolumeX, Loader2, Anchor, RefreshCw } from "lucide-react";

interface Message {
  id: number;
  content: string;
  x: number;
  y: number;
  z: number;
  created_at: string;
  isNew?: boolean;
}

// ==========================================
// 1. PROCEDURAL OCEAN AUDIO SYNTHESIS
// ==========================================
class OceanSynthesizer {
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
    this.filter.frequency.value = 350; 
    this.filter.Q.value = 1.0;

    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.value = 0.12;
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 150; 

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.15;

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

  setVolume(vol: number) {
    if (this.gain) {
      this.gain.gain.value = vol;
    }
  }
}

const oceanSynth = typeof window !== "undefined" ? new OceanSynthesizer() : null;

// ==========================================
// 2. TROPICAL SHIMMER SHADER WATER
// ==========================================
function TropicalOceanWater() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      const position = meshRef.current.geometry.attributes.position;
      
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        
        // Complex wave superposition matching tropical currents
        const z = 
          Math.sin(x * 0.35 + time * 0.9) * 0.14 +
          Math.cos(y * 0.3 + time * 0.7) * 0.12 +
          Math.sin((x + y) * 0.15 + time * 1.1) * 0.06;
          
        position.setZ(i, z);
      }
      position.needsUpdate = true;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[40, 40, 64, 64]} />
      <meshPhysicalMaterial 
        color="#00a8cc" // Shimmering light teal surface
        emissive="#005082" // Deep tropical blue core bloom
        roughness={0.1} 
        metalness={0.1}
        transmission={0.6}
        thickness={1.5}
        transparent
        opacity={0.88}
        flatShading={true}
      />
    </mesh>
  );
}

// ==========================================
// 3. PHYSICAL BOTTLE (Realistic Scale)
// ==========================================
interface BottleProps {
  message: Message;
  index: number;
  focusedId: number | null;
  onFocus: (msg: Message) => void;
}

function PhysicalBottle({ message, index, focusedId, onFocus }: BottleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const isTarget = focusedId === message.id;

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();

    // Natural organic wave bobbing parameters
    const waveOffset = Math.sin(time * 1.1 + message.x) * 0.035;
    groupRef.current.position.y = -0.08 + waveOffset;

    // Oceanic rotation drifts (Gentle and slow)
    groupRef.current.rotation.y = time * 0.08 + (index * 60);
    groupRef.current.rotation.z = Math.sin(time + index) * 0.05;
    groupRef.current.rotation.x = Math.cos(time * 0.6 + index) * 0.03;
  });

  // Calculate fading for non-selected bottles during focus mode
  const isAnyFocused = focusedId !== null;
  const opacity = isAnyFocused ? (isTarget ? 1.0 : 0.18) : 0.9;

  return (
    <group 
      ref={groupRef} 
      position={[message.x, 0, message.z]} 
      onClick={(e) => {
        e.stopPropagation();
        onFocus(message);
      }}
    >
      {/* Outer Glass Container */}
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.35, 16]} />
        <meshPhysicalMaterial 
          color="#d2f1f2" 
          transmission={0.9} 
          thickness={0.08} 
          roughness={0.1} 
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.08, 12]} />
        <meshPhysicalMaterial 
          color="#d2f1f2" 
          transmission={0.9} 
          roughness={0.1} 
          transparent 
          opacity={opacity} 
        />
      </mesh>
      {/* Natural Cork */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.03, 12]} />
        <meshStandardMaterial 
          color="#bfa280" 
          roughness={0.9} 
          transparent 
          opacity={opacity} 
        />
      </mesh>
      {/* Rolled Message Paper inside */}
      <mesh position={[0, -0.04, 0]} rotation={[0, 0.15, 0.1]}>
        <cylinderGeometry args={[0.045, 0.045, 0.2, 10]} />
        <meshStandardMaterial 
          color="#fcf2db" 
          roughness={0.7} 
          transparent 
          opacity={opacity} 
        />
      </mesh>
    </group>
  );
}

// ==========================================
// 4. INTERACTIVE DYNAMIC CAMERA RIG
// ==========================================
interface RigProps {
  focusedMessage: Message | null;
}

function CameraRig({ focusedMessage }: RigProps) {
  const { camera } = useThree();

  useFrame(() => {
    let targetX = 0;
    let targetY = 1.6;
    let targetZ = 3.6;
    let lookTarget = new THREE.Vector3(0, 0, 0);

    if (focusedMessage) {
      // Zoom in directly next to the focused bottle
      targetX = focusedMessage.x * 0.7;
      targetY = 0.25; // Close to the sea surface level
      targetZ = focusedMessage.z * 0.7;
      
      // Interpolate looking point straight at the physical bottle coordinates
      lookTarget.set(focusedMessage.x, -0.05, focusedMessage.z);
    } else {
      // Normal overview looking back across the wider tropical horizon
      lookTarget.set(0, -0.1, 0);
    }

    // Smooth camera adjustments
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.06);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.06);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.06);

    // Dynamic rotation alignment
    const currentLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    const nextLook = currentLook.lerp(lookTarget, 0.06);
    camera.lookAt(nextLook);
  });

  return null;
}

// ==========================================
// 5. MAIN PAGE LAYOUT & STATES
// ==========================================
export default function MessageInABottle() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [casting, setCasting] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [focusedMessage, setFocusedMessage] = useState<Message | null>(null);

  // Fetch all messages and space them out in an aesthetic circular grid
  const fetchMessages = async (newAddedId?: number) => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        const mapped: Message[] = data.map((msg: any, idx: number) => {
          const angle = (idx / data.length) * Math.PI * 2;
          const radius = 1.1 + (idx % 3) * 0.35; // Compact ring system
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
      console.error("Failed to load ocean:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const castMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });

      if (res.ok) {
        setNewMessage("");
        setCasting(false);
        fetchMessages(); 
      }
    } catch (err) {
      console.error("Failed to drop bottle:", err);
    } finally {
      setSubmitting(false);
    }
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
    <main className="relative h-screen w-screen bg-[#F7F4EB] text-[#0F1E2C] overflow-hidden">
      
      {/* 3D CANVAS BACKGROUND */}
      <div className="absolute inset-0 w-full h-full z-0 bg-gradient-to-b from-[#b2ebf2] via-[#F7F4EB] to-[#122e40]">
        <Canvas>
          <ambientLight intensity={0.4} />
          <directionalLight position={[12, 20, 10]} intensity={1.6} color="#fffef0" />
          <pointLight position={[0, -4, 0]} intensity={1.2} color="#00e5ff" />
          
          <Stars radius={100} depth={20} count={60} factor={1.2} saturation={0.5} fade speed={0.3} />
          
          <TropicalOceanWater />

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

      {/* TROPICAL BRAND BANNER */}
      <div className="absolute top-6 left-6 z-30 pointer-events-none select-none">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-sm tracking-[0.25em] font-extrabold uppercase text-[#0F1E2C] flex items-center gap-1.5">
            <Anchor className="w-4 h-4 text-[#008080]" />
            Driftwood & Whispers
          </h1>
          <p className="text-[10px] tracking-wider text-[#008080] font-bold">
            {messages.length} messages drifting near the beach
          </p>
        </div>
      </div>

      {/* AUDIO ACTION CONTROLS */}
      <div className="absolute top-6 right-6 z-30 pointer-events-auto">
        <button
          onClick={toggleAudio}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#DFD3C3] bg-white/80 backdrop-blur-md text-xs font-bold tracking-wider text-[#0F1E2C] hover:bg-white transition-all shadow-sm"
        >
          {isAudioPlaying ? (
            <>
              <Volume2 className="w-4 h-4 text-[#008080] animate-pulse" />
              <span>Waves playing</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-slate-500" />
              <span>Mute ambient waves</span>
            </>
          )}
        </button>
      </div>

      {/* FOCUS WINDOW & BACK BUTTONS */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-4 w-full px-4 max-w-sm pointer-events-auto">
        
        {focusedMessage ? (
          <div className="w-full transform transition-all duration-300 ease-out animate-in slide-in-from-bottom-5">
            <div className="relative overflow-hidden rounded-2xl border border-[#DFD3C3] bg-[#FCF8F2] shadow-2xl p-5">
              <button 
                onClick={() => setFocusedMessage(null)}
                className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-[#0F1E2C] hover:bg-[#EFEAE2] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative bg-white text-slate-800 p-5 rounded-xl shadow-inner border border-[#E9DAC6] font-serif italic text-sm leading-relaxed max-h-36 overflow-y-auto">
                <div className="absolute inset-0 bg-[radial-gradient(#E9DAC6_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />
                "{focusedMessage.content}"
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[9px] text-slate-500 uppercase font-extrabold">
                  Sunk {new Date(focusedMessage.created_at).toLocaleDateString()}
                </span>
                
                {/* RETURN TO HORIZON ACTION */}
                <button
                  onClick={() => setFocusedMessage(null)}
                  className="flex items-center gap-1 text-[9px] text-[#008080] font-extrabold uppercase tracking-widest hover:text-[#006666] transition-colors"
                >
                  <RefreshCw className="w-3 h-3 animate-spin-slow" />
                  Return to Horizon
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CAST ACTION BUTTON (When there is no focus active) */
          <button
            onClick={() => setCasting(true)}
            className="group flex items-center gap-2 px-6 py-3.5 rounded-full border border-[#008080]/30 bg-[#008080] shadow-[0_4px_15px_rgba(0,128,128,0.2)] hover:shadow-[0_4px_25px_rgba(0,128,128,0.35)] hover:bg-[#006666] transition-all duration-300 text-xs tracking-widest uppercase font-bold text-white active:scale-95"
          >
            <Plus className="w-4 h-4 text-white group-hover:rotate-90 transition-transform duration-300" />
            Cast a Message
          </button>
        )}
      </div>

      {/* FLOATING DIALOGUE MODAL */}
      {casting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#0F1E2C]/55 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#DFD3C3] bg-white shadow-2xl p-6 transform transition-transform duration-300 scale-100 animate-in zoom-in-95">
            
            <button
              onClick={() => setCasting(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-sm tracking-[0.25em] uppercase font-bold text-[#0F1E2C] mb-1">
              Seal Your Message
            </h2>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Whisper your thoughts to the tide. Once sealed, your message will drop into the sunlit ocean ripples below.
            </p>

            <form onSubmit={castMessage} className="space-y-4">
              <div className="relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type something beautiful..."
                  maxLength={280}
                  rows={4}
                  required
                  className="w-full resize-none rounded-xl border border-[#DFD3C3] bg-[#FCF8F2] p-4 text-xs text-[#0F1E2C] placeholder-slate-400 focus:border-[#008080] focus:outline-none focus:ring-1 focus:ring-[#008080]/30 transition-all duration-200 font-sans leading-relaxed"
                />
                <span className="absolute bottom-3 right-3 text-[9px] text-slate-400 font-bold tracking-wider">
                  {newMessage.length}/280
                </span>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCasting(false)}
                  className="px-4 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-[#008080] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#006666] disabled:bg-slate-200 disabled:text-slate-400 transition-colors cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Sealing...
                    </>
                  ) : (
                    "Cast Out"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}