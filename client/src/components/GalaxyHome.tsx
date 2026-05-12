import { useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Stars, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Page } from "../App";

// ─── types ───────────────────────────────────────────────────────────────────

type AppDef = {
  page: Page; label: string; color: string; emissive: string;
  size: number; orbitRadius: number; speed: number; tilt: number;
  ring: boolean; texturePath: string;
};

type BgDef = {
  id: string; texturePath: string; cloudPath?: string;
  position: [number, number, number]; size: number;
  rotSpeed: number; axialTilt: number;
  hasRing: boolean; ringColor?: string; fallbackColor: string;
};

type MeshEvents = {
  onPointerEnter: (e: any) => void;
  onPointerLeave: (e: any) => void;
  onClick: (e: any) => void;
};

// ─── data ─────────────────────────────────────────────────────────────────────

const APPS: AppDef[] = [
  { page: "tasks",         label: "Tasks",         color: "#a78bfa", emissive: "#7c3aed", size: 0.55, orbitRadius: 3.0,  speed: 0.50, tilt: 0.00,  ring: false, texturePath: "/textures/2k_mercury.jpg"       },
  { page: "week",          label: "This Week",     color: "#93c5fd", emissive: "#2563eb", size: 0.46, orbitRadius: 4.5,  speed: 0.38, tilt: 0.06,  ring: false, texturePath: "/textures/2k_moon.jpg"          },
  { page: "calendar",      label: "Calendar",      color: "#6ee7b7", emissive: "#059669", size: 0.64, orbitRadius: 6.0,  speed: 0.28, tilt: -0.05, ring: false, texturePath: "/textures/2k_earth_daymap.jpg"  },
  { page: "documentation", label: "Knowledge",     color: "#fcd34d", emissive: "#d97706", size: 0.54, orbitRadius: 7.6,  speed: 0.22, tilt: 0.08,  ring: false, texturePath: "/textures/2k_jupiter.jpg"       },
  { page: "boards",        label: "Boards",        color: "#f9a8d4", emissive: "#db2777", size: 0.60, orbitRadius: 9.2,  speed: 0.17, tilt: -0.06, ring: false, texturePath: "/textures/2k_venus_surface.jpg" },
  { page: "journal",       label: "Settings",      color: "#cbd5e1", emissive: "#475569", size: 0.44, orbitRadius: 10.7, speed: 0.13, tilt: 0.04,  ring: false, texturePath: "/textures/2k_mars.jpg"          },
  { page: "finance",       label: "Finance",       color: "#86efac", emissive: "#16a34a", size: 0.64, orbitRadius: 12.2, speed: 0.10, tilt: -0.03, ring: true,  texturePath: "/textures/2k_saturn.jpg"        },
  { page: "notifications", label: "Notifications", color: "#fdba74", emissive: "#ea580c", size: 0.52, orbitRadius: 13.6, speed: 0.08, tilt: 0.05,  ring: false, texturePath: "/textures/2k_neptune.jpg"       },
];

const BG_PLANETS: BgDef[] = [
  { id: "earth",   texturePath: "/textures/2k_earth_daymap.jpg", cloudPath: "/textures/2k_earth_clouds.jpg", position: [-22, 5, -20], size: 5.2, rotSpeed: 0.0025, axialTilt: 0.41, hasRing: false, fallbackColor: "#1e40af" },
  // { id: "jupiter", texturePath: "/textures/2k_jupiter.jpg",      position: [26, -4, -28], size: 8.5, rotSpeed: 0.009,  axialTilt: 0.05, hasRing: false, fallbackColor: "#92400e" },
  // { id: "saturn",  texturePath: "/textures/2k_saturn.jpg",       position: [-30, -9, -18], size: 4.2, rotSpeed: 0.004, axialTilt: 0.47, hasRing: true, ringColor: "#c8a050", fallbackColor: "#ca8a04" },
];

// ─── sun ──────────────────────────────────────────────────────────────────────

function Sun() {
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (coreRef.current) coreRef.current.rotation.y += 0.004;
    if (glowRef.current) glowRef.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.035);
    if (r1.current) r1.current.rotation.z += 0.008;
    if (r2.current) r2.current.rotation.z -= 0.005;
  });
  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.72, 32, 32]} />
        <meshStandardMaterial color="#fff8dc" emissive="#ffcc00" emissiveIntensity={5} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.18, 16, 16]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff5500" emissiveIntensity={1.5} transparent opacity={0.10} depthWrite={false} />
      </mesh>
      <mesh ref={r1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.65, 0.022, 2, 80]} />
        <meshStandardMaterial color="#818cf8" emissive="#6366f1" emissiveIntensity={3} transparent opacity={0.75} />
      </mesh>
      <mesh ref={r2} rotation={[Math.PI / 3, 0.3, 0]}>
        <torusGeometry args={[2.05, 0.015, 2, 80]} />
        <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={3} transparent opacity={0.55} />
      </mesh>
      <pointLight color="#fff8e7" intensity={6} distance={55} />
      <pointLight color="#ffd700" intensity={2.5} distance={28} />
    </group>
  );
}

// ─── orbit ring ───────────────────────────────────────────────────────────────

function OrbitRing({ radius, tilt }: { radius: number; tilt: number }) {
  return (
    <mesh rotation={[Math.PI / 2 + tilt * 0.5, 0, 0]}>
      <torusGeometry args={[radius, 0.006, 2, 180]} />
      <meshBasicMaterial color="#1e3a5f" transparent opacity={0.4} />
    </mesh>
  );
}

// ─── planet ───────────────────────────────────────────────────────────────────

// Loaded: real texture via useLoader (suspends until ready)
function PlanetTexturedMesh({ app, hovered, events }: { app: AppDef; hovered: boolean; events: MeshEvents }) {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, app.texturePath);
  texture.colorSpace = THREE.SRGBColorSpace;
  useFrame(() => { if (ref.current) ref.current.rotation.y += 0.01; });
  return (
    <mesh ref={ref} {...events}>
      <sphereGeometry args={[app.size, 44, 44]} />
      <meshStandardMaterial map={texture} color="#ffffff" emissive={app.emissive} emissiveIntensity={hovered ? 1.6 : 0.06} roughness={0.78} metalness={0.02} />
    </mesh>
  );
}

// Fallback: colored sphere while texture loads
function PlanetFallbackMesh({ app, hovered, events }: { app: AppDef; hovered: boolean; events: MeshEvents }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) ref.current.rotation.y += 0.01; });
  return (
    <mesh ref={ref} {...events}>
      <sphereGeometry args={[app.size, 28, 28]} />
      <meshStandardMaterial color={app.color} emissive={app.emissive} emissiveIntensity={hovered ? 3.8 : 2.2} roughness={0.5} metalness={0.05} />
    </mesh>
  );
}

function Planet({ app, initialAngle, onClick, notifCount = 0 }: {
  app: AppDef; initialAngle: number;
  onClick: (page: Page, pos: THREE.Vector3) => void;
  notifCount?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(initialAngle);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    angleRef.current += delta * app.speed;
    const a = angleRef.current;
    if (groupRef.current) {
      groupRef.current.position.set(
        Math.cos(a) * app.orbitRadius,
        Math.sin(a) * app.orbitRadius * app.tilt,
        Math.sin(a) * app.orbitRadius,
      );
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (!groupRef.current) return;
    const pos = new THREE.Vector3();
    groupRef.current.getWorldPosition(pos);
    onClick(app.page, pos);
  };

  const events: MeshEvents = {
    onPointerEnter: (e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; },
    onPointerLeave: (e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = "default"; },
    onClick: handleClick,
  };

  return (
    <group ref={groupRef}>
      <group scale={hovered ? 1.28 : 1}>
        {/* Textured or colored fallback */}
        <Suspense fallback={<PlanetFallbackMesh app={app} hovered={hovered} events={events} />}>
          <PlanetTexturedMesh app={app} hovered={hovered} events={events} />
        </Suspense>

        {/* Atmosphere rim */}
        <mesh scale={1.07}>
          <sphereGeometry args={[app.size, 16, 16]} />
          <meshStandardMaterial color={app.color} emissive={app.emissive} emissiveIntensity={hovered ? 0.9 : 0.25} transparent opacity={0.09} depthWrite={false} side={THREE.BackSide} />
        </mesh>

        {/* Saturn-style ring */}
        {app.ring && (
          <mesh rotation={[Math.PI / 2.4, 0.2, 0]}>
            <torusGeometry args={[app.size * 1.9, app.size * 0.15, 2, 80]} />
            <meshStandardMaterial color="#d4a855" emissive="#8b6914" emissiveIntensity={hovered ? 1.0 : 0.35} transparent opacity={0.65} roughness={0.9} />
          </mesh>
        )}
      </group>

      {/* Hover tooltip */}
      {hovered && (
        <Html center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(2,6,23,0.92)", border: `1px solid ${app.color}55`,
            borderRadius: 8, padding: "5px 14px", color: app.color,
            fontSize: 11, fontWeight: 700, letterSpacing: 2, whiteSpace: "nowrap",
            transform: "translateY(-44px)", textShadow: `0 0 10px ${app.color}`,
            fontFamily: "system-ui, sans-serif",
          }}>
            {app.label.toUpperCase()}
          </div>
        </Html>
      )}

      {/* Notif badge */}
      {notifCount > 0 && (
        <Html center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "#ef4444", border: "2px solid #020617", borderRadius: "50%",
            width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 9, fontWeight: 700,
            transform: `translate(${app.size * 36}px, -${app.size * 36}px)`,
            fontFamily: "system-ui, sans-serif",
          }}>
            {notifCount > 99 ? "99+" : notifCount}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── background planets ───────────────────────────────────────────────────────

function BgPlanetLoaded({ def }: { def: BgDef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, def.texturePath);
  texture.colorSpace = THREE.SRGBColorSpace;
  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += def.rotSpeed;
    if (cloudsRef.current) cloudsRef.current.rotation.y += def.rotSpeed * 1.12;
  });
  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[def.size, 56, 56]} />
        <meshStandardMaterial map={texture} color="#ffffff" emissive={def.fallbackColor} emissiveIntensity={0.04} roughness={0.88} />
      </mesh>
      {def.cloudPath && <BgCloudLayer def={def} />}
      {def.hasRing && <BgRing def={def} />}
    </>
  );
}

function BgCloudLayer({ def }: { def: BgDef }) {
  const ref = useRef<THREE.Mesh>(null);
  const tex = useLoader(THREE.TextureLoader, def.cloudPath!);
  tex.colorSpace = THREE.SRGBColorSpace;
  useFrame(() => { if (ref.current) ref.current.rotation.y += def.rotSpeed * 1.12; });
  return (
    <mesh ref={ref} scale={1.006}>
      <sphereGeometry args={[def.size, 40, 40]} />
      <meshStandardMaterial map={tex} transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}

function BgRing({ def }: { def: BgDef }) {
  return (
    <mesh rotation={[Math.PI / 2.1, 0.1, 0]}>
      <torusGeometry args={[def.size * 2.0, def.size * 0.42, 2, 120]} />
      <meshStandardMaterial color={def.ringColor ?? "#c8a050"} transparent opacity={0.52} roughness={0.95} />
    </mesh>
  );
}

function BgPlanetFallback({ def }: { def: BgDef }) {
  return (
    <>
      <mesh>
        <sphereGeometry args={[def.size, 32, 32]} />
        <meshStandardMaterial color={def.fallbackColor} emissive={def.fallbackColor} emissiveIntensity={0.12} roughness={0.88} />
      </mesh>
      {def.hasRing && <BgRing def={def} />}
    </>
  );
}

function BackgroundPlanet({ def }: { def: BgDef }) {
  return (
    <group position={def.position} rotation={[def.axialTilt, 0, 0]}>
      <Suspense fallback={<BgPlanetFallback def={def} />}>
        <BgPlanetLoaded def={def} />
      </Suspense>
    </group>
  );
}

// ─── scene ────────────────────────────────────────────────────────────────────

function Scene({ onNavigate, notifCount }: { onNavigate: (p: Page) => void; notifCount: number }) {
  const { camera } = useThree();
  const navRef = useRef<{ target: THREE.Vector3 } | null>(null);

  const handlePlanetClick = (page: Page, pos: THREE.Vector3) => {
    navRef.current = { target: pos.clone() };
    setTimeout(() => { onNavigate(page); navRef.current = null; }, 720);
  };

  useFrame(() => {
    if (navRef.current) {
      const t = navRef.current.target;
      camera.position.lerp(new THREE.Vector3(t.x * 0.38, 3, t.z * 0.38), 0.065);
    }
  });

  return (
    <>
      <ambientLight intensity={0.18} />
      <Stars radius={140} depth={60} count={7000} factor={4} saturation={0.2} fade speed={0.3} />
      {BG_PLANETS.map((def) => <BackgroundPlanet key={def.id} def={def} />)}
      <Sun />
      {APPS.map((app) => <OrbitRing key={`ring-${app.page}`} radius={app.orbitRadius} tilt={app.tilt} />)}
      {APPS.map((app, i) => (
        <Planet key={app.page} app={app} initialAngle={(i / APPS.length) * Math.PI * 2}
          onClick={handlePlanetClick} notifCount={app.page === "notifications" ? notifCount : 0} />
      ))}
      <EffectComposer>
        <Bloom luminanceThreshold={0.14} luminanceSmoothing={0.9} intensity={2.0} />
      </EffectComposer>
    </>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (page: Page) => void;
  notifCount?: number;
  onLogout?: () => void;
}

export default function GalaxyHome({ onNavigate, notifCount = 0, onLogout }: Props) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{
      width: "100vw", height: "100vh", position: "relative", overflow: "hidden",
      background: `
        radial-gradient(ellipse 55% 38% at 12% 22%, rgba(88,28,135,0.20) 0%, transparent 70%),
        radial-gradient(ellipse 48% 34% at 88% 14%, rgba(30,58,138,0.16) 0%, transparent 65%),
        radial-gradient(ellipse 42% 30% at 75% 88%, rgba(6,78,59,0.13) 0%, transparent 60%),
        radial-gradient(ellipse 50% 36% at 6%  78%, rgba(76,29,149,0.12) 0%, transparent 55%),
        #000008
      `,
    }}>
      <div style={{
        position: "absolute", top: 32, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, textAlign: "center", pointerEvents: "none", userSelect: "none",
      }}>
        <div style={{ color: "#fff", fontSize: 34, fontWeight: 800, letterSpacing: 12, fontFamily: "system-ui, sans-serif", textShadow: "0 0 30px rgba(99,102,241,0.6), 0 0 60px rgba(99,102,241,0.2)" }}>
          ORBIT
        </div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, letterSpacing: 3, marginTop: 8, fontFamily: "system-ui, sans-serif" }}>
          {timeStr} · {dateStr}
        </div>
      </div>

      <div style={{
        position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, color: "rgba(255,255,255,0.18)", fontSize: 10, letterSpacing: 4,
        pointerEvents: "none", fontFamily: "system-ui, sans-serif", textTransform: "uppercase", userSelect: "none",
      }}>
        Click a planet to explore
      </div>

      {onLogout && (
        <button onClick={onLogout} title="Sign out" style={{
          position: "absolute", top: 20, right: 20, zIndex: 10,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          color: "rgba(255,255,255,0.3)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 16,
        }}>⏻</button>
      )}

      <Canvas camera={{ position: [0, 9, 20], fov: 56 }} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true, alpha: true }}>
        <Scene onNavigate={onNavigate} notifCount={notifCount} />
      </Canvas>
    </div>
  );
}
