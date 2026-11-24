import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../shared/useGameStore'
import { installGlobalMuteController } from './audio'
import { KomradBobbleheads3D } from './KomradBobbleheads3D'
import { DesktopComputer3D } from './DesktopComputer3D'
import {
  getBrushedBrassTextures,
  getHammeredIronTextures,
  getWeatheredMahoganyTextures,
  getWornInspectionMatTextures,
} from '../../shared/proceduralMaterials'

const NOOP_RAYCAST: THREE.Object3D['raycast'] = () => {}

export function InspectorDesk3D() {
  const isSeatedAtDesk = useGameStore((s) => s.isSeatedAtDesk)
  const setInspectingDesk = useGameStore((s) => s.setInspectingDesk)

  const bobbleShockwaveRef = useRef<{ kristianov: number; oleg: number }>({
    kristianov: 0,
    oleg: 0,
  })

  const ironTex = useMemo(() => getHammeredIronTextures(), [])
  const brassTex = useMemo(() => getBrushedBrassTextures(), [])
  const mahoganyTex = useMemo(() => getWeatheredMahoganyTextures(), [])
  const wornMatTex = useMemo(() => getWornInspectionMatTextures(), [])

  useEffect(() => installGlobalMuteController(), [])

  useEffect(() => {
    setInspectingDesk(isSeatedAtDesk)
  }, [isSeatedAtDesk, setInspectingDesk])

  return (
    <group
      position={[0, 0.06, -0.96]}
      rotation={[0, 0, 0]}
      scale={0.72}
    >
      {/* Heavy Hammered-Iron Sub-Desk Plinth Anchored to Capsule Floor */}
      <mesh position={[0, -0.042, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[3.04, 0.09, 1.3]} />
        <meshStandardMaterial
          color="#18211b"
          metalness={0.68}
          roughness={0.48}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* ============================================================
          SOVIET SENIOR INSPECTOR COMMAND DESK (2.48m × 1.36m)
          WITH WEATHERED MAHOGANY TRIM, WORN BAIZE MAT & BRASS BRACKETS
         ============================================================ */}
      <mesh position={[0, 0.44, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.36, 0.88, 1.26]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.45}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>
      <mesh position={[0, 0.89, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.48, 0.055, 1.36]} />
        <meshStandardMaterial
          color="#6b3e28"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
          metalness={0.12}
        />
      </mesh>
      {/* Stepped Carved Mahogany Perimeter Molding Rails */}
      <mesh position={[0, 0.922, -0.66]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.48, 0.022, 0.04]} />
        <meshStandardMaterial
          color="#5c3422"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[0, 0.92, 0.66]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.48, 0.016, 0.04]} />
        <meshStandardMaterial
          color="#5c3422"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[-1.22, 0.922, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.04, 0.022, 1.28]} />
        <meshStandardMaterial
          color="#5c3422"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[1.22, 0.922, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.04, 0.022, 1.28]} />
        <meshStandardMaterial
          color="#5c3422"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
        />
      </mesh>
      {/* Solid Side Desk Wing Bolsters Extending Outward to Meet the Wraparound Soviet Console Collar */}
      {([-1, 1] as const).map((side) => (
        <group key={`desk-wing-bolster-${side}`}>
          <mesh position={[side * 1.38, 0.44, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.42, 0.88, 1.24]} />
            <meshStandardMaterial
              color="#202c26"
              roughness={0.46}
              metalness={0.66}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
              roughnessMap={ironTex.roughnessMap}
            />
          </mesh>
          <mesh position={[side * 1.415, 0.89, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.35, 0.055, 1.34]} />
            <meshStandardMaterial
              color="#3a281d"
              map={mahoganyTex.map}
              bumpMap={mahoganyTex.bumpMap}
              bumpScale={0.005}
              roughnessMap={mahoganyTex.roughnessMap}
              roughness={0.54}
              metalness={0.18}
            />
          </mesh>
          <mesh position={[side * 1.595, 0.46, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.03, 0.92, 1.28]} />
            <meshStandardMaterial
              color="#18211b"
              roughness={0.48}
              metalness={0.68}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.007}
              roughnessMap={ironTex.roughnessMap}
            />
          </mesh>
        </group>
      ))}

      {/* Worn Soviet Inspection Mat (#16241f with cross-grain leather, coffee-mug rings & scuffs) */}
      <mesh position={[0, 0.92, 0.02]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.28, 0.008, 1.2]} />
        <meshStandardMaterial
          color="#ffffff"
          map={wornMatTex.map}
          bumpMap={wornMatTex.bumpMap}
          bumpScale={0.004}
          roughnessMap={wornMatTex.roughnessMap}
          roughness={0.85}
        />
      </mesh>

      {/* Inlaid Double-Brass Pinstripe Border on the Green Mat */}
      <mesh position={[0, 0.926, -0.56]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.24, 0.002, 0.006]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh position={[0, 0.926, 0.6]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.24, 0.002, 0.006]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh position={[-1.12, 0.926, 0.02]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.006, 0.002, 1.154]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh position={[1.12, 0.926, 0.02]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.006, 0.002, 1.154]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* 4 Heavy Riveted Brushed-Brass Corner Brackets on the Green Mat */}
      {(
        [
          [-1.1, -0.54],
          [1.1, -0.54],
          [-1.1, 0.58],
          [1.1, 0.58],
        ] as const
      ).map(([cx, cz], idx) => (
        <group key={idx} position={[cx, 0.926, cz]}>
          <mesh raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.08, 0.005, 0.08]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
              roughnessMap={brassTex.roughnessMap}
            />
          </mesh>
          <mesh position={[0, 0.004, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.008, 0.008, 0.006, 8]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.9}
              roughness={0.22}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        </group>
      ))}

      {/* Flanking Komrad Kristianov & Komrad Oleg Bobbleheads */}
      <KomradBobbleheads3D shockwaveRef={bobbleShockwaveRef} />

      {/* Center 3D ISKRA-84 Desktop Workstation */}
      <DesktopComputer3D />
    </group>
  )
}
