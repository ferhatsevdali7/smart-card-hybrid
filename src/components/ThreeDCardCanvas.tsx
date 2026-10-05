import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { SmartCard } from '../types/card';

interface CardMeshProps {
  card: SmartCard;
  isFlipped: boolean;
  onFlip: () => void;
}

function CardMesh({ card, isFlipped, onFlip }: CardMeshProps) {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Smooth rotation animation towards target (0 rad vs Math.PI rad)
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Target rotation Y
    const targetRotY = isFlipped ? Math.PI : 0;
    meshRef.current.rotation.y = THREE.MathUtils.damp(
      meshRef.current.rotation.y,
      targetRotY,
      8,
      delta
    );

    // Subtle pointer parallax tilt
    const pointer = state.pointer;
    const targetRotX = pointer.y * 0.25;
    const targetTiltZ = -pointer.x * 0.15;

    meshRef.current.rotation.x = THREE.MathUtils.damp(
      meshRef.current.rotation.x,
      targetRotX,
      6,
      delta
    );

    meshRef.current.rotation.z = THREE.MathUtils.damp(
      meshRef.current.rotation.z,
      targetTiltZ,
      6,
      delta
    );
  });

  return (
    <group 
      ref={meshRef} 
      onClick={onFlip}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      scale={hovered ? 1.05 : 1}
      
    >
      {/* Physical Card Body (CR-80 Dimensions: ~3.375 x 2.125 x 0.04 units) */}
      <RoundedBox args={[3.375, 2.125, 0.04]} radius={0.12} smoothness={4}>
        <meshPhysicalMaterial
          color={isFlipped ? "#090d16" : "#14798D"}
          roughness={0.25}
          metalness={0.8}
          clearcoat={0.9}
          clearcoatRoughness={0.15}
          reflectivity={0.9}
        />
      </RoundedBox>

      {/* FRONT TEXT LABELS (Medical Front) */}
      <group position={[0, 0, 0.025]}>
        <Text
          position={[-1.3, 0.75, 0]}
          fontSize={0.11}
          color="#D1C8B9"
          anchorX="left"
          anchorY="middle"
          fontWeight="bold"
        >
          ACIL SAGLIK KARTI
        </Text>

        <Text
          position={[-1.3, 0.25, 0]}
          fontSize={0.16}
          color="#ffffff"
          anchorX="left"
          anchorY="middle"
          fontWeight="bold"
        >
          {card.medical.fullName}
        </Text>

        <Text
          position={[-1.3, -0.05, 0]}
          fontSize={0.09}
          color="#D1C8B9"
          anchorX="left"
          anchorY="middle"
        >
          {`D. Yili: ${card.medical.birthYear} | ICE: ${card.medical.emergencyContacts[0]?.phone || ''}`}
        </Text>

        {/* Blood Type Badge In 3D */}
        <group position={[1.1, 0.15, 0]}>
          <RoundedBox args={[0.7, 0.7, 0.02]} radius={0.08} smoothness={2}>
            <meshStandardMaterial color="#509BEC" roughness={0.2} metalness={0.5} />
          </RoundedBox>
          <Text
            position={[0, 0.12, 0.02]}
            fontSize={0.08}
            color="#ffe4e6"
            anchorX="center"
            anchorY="middle"
          >
            KAN
          </Text>
          <Text
            position={[0, -0.08, 0.02]}
            fontSize={0.22}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            {card.medical.bloodType}
          </Text>
        </group>

        <Text
          position={[-1.3, -0.75, 0]}
          fontSize={0.08}
          color="#D1C8B9"
          anchorX="left"
          anchorY="middle"
        >
          NFC &amp; QR DESTEKLI
        </Text>

        <Text
          position={[1.3, -0.75, 0]}
          fontSize={0.09}
          color="#ffffff"
          anchorX="right"
          anchorY="middle"
          fontWeight="bold"
        >
          {card.cardId}
        </Text>
      </group>

      {/* BACK TEXT LABELS (Personal Back) */}
      <group position={[0, 0, -0.025]} rotation={[0, Math.PI, 0]}>
        <Text
          position={[-1.3, 0.75, 0]}
          fontSize={0.11}
          color="#93c5fd"
          anchorX="left"
          anchorY="middle"
          fontWeight="bold"
        >
          DIJITAL KARTVIZIT &amp; IBAN
        </Text>

        <Text
          position={[-1.3, 0.25, 0]}
          fontSize={0.16}
          color="#ffffff"
          anchorX="left"
          anchorY="middle"
          fontWeight="bold"
        >
          {card.personal.fullName}
        </Text>

        <Text
          position={[-1.3, -0.02, 0]}
          fontSize={0.09}
          color="#60a5fa"
          anchorX="left"
          anchorY="middle"
        >
          {card.personal.title || ''}
        </Text>

        <Text
          position={[-1.3, -0.22, 0]}
          fontSize={0.08}
          color="#94a3b8"
          anchorX="left"
          anchorY="middle"
        >
          {card.personal.bankAccounts[0]?.bankName || ''}: {card.personal.bankAccounts[0]?.iban.slice(0, 16)}...
        </Text>

        <Text
          position={[-1.3, -0.75, 0]}
          fontSize={0.08}
          color="#34d399"
          anchorX="left"
          anchorY="middle"
        >
          60 SN GUVENLI GIRIS
        </Text>

        <Text
          position={[1.3, -0.75, 0]}
          fontSize={0.09}
          color="#cbd5e1"
          anchorX="right"
          anchorY="middle"
          fontWeight="bold"
        >
          PIN KORUMALI
        </Text>
      </group>
    </group>
  );
}

interface ThreeDCardCanvasProps {
  card: SmartCard;
  onOpenSOS?: () => void;
  onOpenPersonal?: () => void;
}

export const ThreeDCardCanvas: React.FC<ThreeDCardCanvasProps> = ({ card, onOpenSOS, onOpenPersonal }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center p-2 space-y-4">
      {/* 3D WebGL Canvas */}
      <div className="w-full max-w-[420px] h-[260px] rounded-3xl bg-slate-900/60 border border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <Canvas camera={{ position: [0, 0, 3.8], fov: 45 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={1.8} color="#ffffff" />
          <pointLight position={[-5, -5, -5]} intensity={0.5} color="#3b82f6" />
          <pointLight position={[3, -2, 4]} intensity={0.8} color="#f43f5e" />

          <Float speed={2.5} rotationIntensity={0.3} floatIntensity={0.5}>
            <CardMesh 
              card={card} 
              isFlipped={isFlipped} 
              onFlip={() => setIsFlipped(!isFlipped)} 
            />
          </Float>
        </Canvas>

        {/* Overlay Tip */}
        <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
          <span className="text-[10px] text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-full border border-slate-800 shadow-sm backdrop-blur-sm">
            ✨ Farenizi hareket ettirerek ışığı yansıtın • Karta tıklayarak çevirin
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-all shadow-md active:scale-98"
        >
          {isFlipped ? '🔄 Ön Yüze Çevir (Sağlık)' : '🔄 Arka Yüze Çevir (Kişisel)'}
        </button>

        {onOpenSOS && (
          <button
            onClick={onOpenSOS}
            className="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-semibold py-2 px-3 rounded-xl transition-all"
          >
            🚨 Ön Yüzü Aç (SOS)
          </button>
        )}

        {onOpenPersonal && (
          <button
            onClick={onOpenPersonal}
            className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 text-xs font-semibold py-2 px-3 rounded-xl transition-all"
          >
            🔒 Arka Yüzü Aç (Kişisel)
          </button>
        )}
      </div>
    </div>
  );
};


