import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Stars, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Page } from "../App";

// ─── types ─────────────────────────────────────────────────────────────────

type AppDef = {
  page: Page;
  label: string;
  subLabel: string;
  color: string;
  emissive: string;
  size: number;
  orbitRadius: number;
  angle: number;
  ring: boolean;
  texturePath: string;
};

// ─── data ──────────────────────────────────────────────────────────────────

const APPS: AppDef[] = [
  { page: "tasks",         label: "TASKS",               subLabel: "TO-DO LIST", color: "#f87171", emissive: "#dc2626", size: 2.90, orbitRadius: 46.0, angle: 215, ring: false, texturePath: "/textures/2k_mercury.jpg"      },
  { page: "week",          label: "THIS WEEK",           subLabel: "WEEK VIEW",            color: "#fbbf24", emissive: "#d97706", size: 3.10, orbitRadius: 39.0, angle: 185, ring: false, texturePath: "/textures/2k_moon.jpg"          },
  { page: "calendar",      label: "CALENDAR ",           subLabel: "CHRONOS METRICS",      color: "#34d399", emissive: "#059669", size: 3.60, orbitRadius: 32.0, angle: 150, ring: false, texturePath: "/textures/2k_earth_daymap.jpg"  },
  { page: "documentation", label: "DOCUMENTATION",       subLabel: "ARCHIVE CORE",         color: "#fcd34d", emissive: "#d97706", size: 3.00, orbitRadius: 24.0, angle: 115, ring: false, texturePath: "/textures/2k_jupiter.jpg"       },
  { page: "boards",        label: "BOARDS",              subLabel: "INFRASTRUCTURE",       color: "#c084fc", emissive: "#7c3aed", size: 3.00, orbitRadius: 24.0, angle: 65,  ring: false, texturePath: "/textures/2k_venus_surface.jpg" },
  { page: "journal",       label: "JOURNAL",             subLabel: "PERSONAL FILES",        color: "#94a3b8", emissive: "#475569", size: 3.10, orbitRadius: 32.0, angle: 25,  ring: false, texturePath: "/textures/2k_mars.jpg"          },
  { page: "finance",       label: "FINANCES",            subLabel: "BANK DETAILS",     color: "#4ade80", emissive: "#16a34a", size: 3.70, orbitRadius: 40.0, angle: -10, ring: true,  texturePath: "/textures/2k_saturn.jpg"        },
  { page: "notifications", label: "NOTIFICATIONS",       subLabel: "LIVE STATUS",   color: "#60a5fa", emissive: "#2563eb", size: 3.40, orbitRadius: 48.0, angle: -40, ring: false, texturePath: "/textures/2k_neptune.jpg"       },
];

// ─── camera ────────────────────────────────────────────────────────────────

function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 18, 54);
    camera.lookAt(0, -2, 0);
  }, [camera]);
  return null;
}

// ─── sun ───────────────────────────────────────────────────────────────────

function Sun() {
  const coreRef  = useRef<THREE.Mesh>(null);
  const glowRef  = useRef<THREE.Mesh>(null);
  
  const sunTexture = useLoader(THREE.TextureLoader, "/textures/2k_sun.jpg");
  sunTexture.colorSpace = THREE.SRGBColorSpace;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (coreRef.current) coreRef.current.rotation.y = t * 0.015;
    if (glowRef.current) glowRef.current.rotation.y = -t * 0.008;
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[6.5, 64, 64]} />
        <meshBasicMaterial 
          map={sunTexture}
          color="#ffffff"
        />
      </mesh>

      <mesh ref={glowRef} scale={1.03}>
        <sphereGeometry args={[6.5, 32, 32]} />
        <meshBasicMaterial
          map={sunTexture}
          color="#ffaa00"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <pointLight color="#fff5e6" intensity={20} distance={300} decay={1} />
    </group>
  );
}

// ─── clock ─────────────────────────────────────────────────────────────────

function ClockDisplay() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hhmm    = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const weekday = now.toLocaleDateString("en-GB",  { weekday: "long" }).toUpperCase();
  const day     = now.getDate();
  const month   = now.toLocaleDateString("en-GB",  { month: "long" }).toUpperCase();
  return (
    <div style={{ textAlign: "center", pointerEvents: "none", userSelect: "none" }}>
      <div style={{ color: "#fff", fontSize: 38, fontWeight: 700, letterSpacing: 4, fontFamily: "system-ui,sans-serif" }}>
        {hhmm}
      </div>
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, letterSpacing: 3, marginTop: 2, fontFamily: "system-ui,sans-serif" }}>
        {weekday} {day} {month}
      </div>
    </div>
  );
}

// ─── orbit ring ────────────────────────────────────────────────────────────

function OrbitRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.04, 2, 200]} />
      <meshBasicMaterial color="#4773b8" transparent opacity={0.25} />
    </mesh>
  );
}

// ─── planet meshes ─────────────────────────────────────────────────────────

type MeshCBs = {
  onClick:        (e: any) => void;
  onPointerEnter: (e: any) => void;
  onPointerLeave: (e: any) => void;
};

function TexturedPlanet({ app, hovered, cbs }: { app: AppDef; hovered: boolean; cbs: MeshCBs }) {
  const ref     = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, app.texturePath);
  texture.colorSpace = THREE.SRGBColorSpace;
  
  useFrame(() => { if (ref.current) ref.current.rotation.y += 0.002; });
  
  return (
    <mesh ref={ref} {...cbs}>
      <sphereGeometry args={[app.size, 48, 48]} />
      <meshPhongMaterial 
        map={texture} 
        emissive={app.emissive}
        emissiveIntensity={hovered ? 1.8 : 0.45} 
        shininess={15}
      />
    </mesh>
  );
}

function FallbackPlanet({ app, hovered, cbs }: { app: AppDef; hovered: boolean; cbs: MeshCBs }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) ref.current.rotation.y += 0.002; });
  return (
    <mesh ref={ref} {...cbs}>
      <sphereGeometry args={[app.size, 32, 32]} />
      <meshPhongMaterial color={app.color} emissive={app.emissive}
        emissiveIntensity={hovered ? 2.0 : 0.8} />
    </mesh>
  );
}

// ─── planet ────────────────────────────────────────────────────────────────

function Planet({ app, onClick, notifCount = 0 }: {
  app: AppDef;
  onClick: (page: Page) => void;
  notifCount?: number;
}) {
  const [hovered, setHovered] = useState(false);

  const rad = (app.angle * Math.PI) / 180;
  const x   = Math.cos(rad) * app.orbitRadius;
  const z   = Math.sin(rad) * app.orbitRadius;

  const cbs: MeshCBs = {
    onClick:        (e) => { e.stopPropagation(); onClick(app.page); },
    onPointerEnter: (e) => { e.stopPropagation(); setHovered(true);  document.body.style.cursor = "pointer"; },
    onPointerLeave: (e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = "default"; },
  };

  return (
    <group position={[x, 0, z]}>
      <group scale={hovered ? 1.10 : 1}>
        <Suspense fallback={<FallbackPlanet app={app} hovered={hovered} cbs={cbs} />}>
          <TexturedPlanet app={app} hovered={hovered} cbs={cbs} />
        </Suspense>

        {/* atmosphere */}
        <mesh scale={1.06}>
          <sphereGeometry args={[app.size, 16, 16]} />
          <meshBasicMaterial color={app.color} transparent opacity={hovered ? 0.15 : 0.04} side={THREE.BackSide} />
        </mesh>

        {/* saturn ring */}
        {app.ring && (
          <mesh rotation={[Math.PI / 2.5, 0.15, 0]}>
            <torusGeometry args={[app.size * 1.65, app.size * 0.10, 2, 80]} />
            <meshBasicMaterial color="#e0b96b" transparent opacity={hovered ? 0.7 : 0.35} />
          </mesh>
        )}
      </group>

      {/* Sci-Fi HUD Label Component */}
      <Html position={[0, app.size + 1.8, 0]} center style={{ pointerEvents: "none", userSelect: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "160px" }}>
          
          <div style={{
            borderLeft: `2px solid ${hovered ? '#ffffff' : 'rgba(255,255,255,0.25)'}`,
            paddingLeft: "8px",
            transition: "all 0.2s ease-in-out",
            transform: hovered ? "scale(1.05)" : "scale(1)"
          }}>
            <div style={{
              color: hovered ? "#ffffff" : "rgba(230, 240, 255, 0.85)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              fontFamily: "monospace, system-ui",
              whiteSpace: "nowrap",
            }}>
              {app.label}
            </div>
            <div style={{
              color: hovered ? app.color : "rgba(255,255,255,0.35)",
              fontSize: 8,
              letterSpacing: 1,
              fontFamily: "monospace",
              marginTop: 2,
              whiteSpace: "nowrap",
            }}>
              {app.subLabel}
            </div>
          </div>

          <div style={{
            width: "1px", 
            height: "20px", 
            marginTop: "4px",
            background: hovered
              ? `linear-gradient(to bottom, #ffffff, ${app.color})`
              : "linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)",
            transition: "all 0.2s"
          }} />
        </div>
      </Html>

      {/* notif badge */}
      {notifCount > 0 && (
        <Html position={[app.size * 0.75, app.size * 0.75, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{
            background: "#ef4444", border: "1.5px solid #020617",
            borderRadius: "50%", width: 16, height: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 8, fontWeight: 700, fontFamily: "sans-serif",
            boxShadow: "0 0 12px #ef4444"
          }}>
            {notifCount > 99 ? "99+" : notifCount}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── scene ─────────────────────────────────────────────────────────────────

function Scene({ onNavigate, notifCount }: { onNavigate: (p: Page) => void; notifCount: number }) {
  const nav = (page: Page) => setTimeout(() => onNavigate(page), 200);
  return (
    <>
      <CameraSetup />
      <ambientLight intensity={0.4} />
      <Stars radius={280} depth={100} count={9000} factor={3.5} saturation={0.5} fade speed={0.1} />
      <Sun />
      {APPS.map((a) => <OrbitRing key={`r-${a.page}`} radius={a.orbitRadius} />)}
      {APPS.map((a) => (
        <Planet key={a.page} app={a} onClick={nav}
          notifCount={a.page === "notifications" ? notifCount : 0} />
      ))}
      <EffectComposer>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.7} intensity={0.7} />
      </EffectComposer>
    </>
  );
}

// ─── main component ────────────────────────────────────────────────────────

interface Props {
  onNavigate: (page: Page) => void;
  notifCount?: number;
  onLogout?: () => void;
  onToggleView?: () => void;
}

export default function GalaxyHome({ onNavigate, notifCount = 0, onLogout, onToggleView }: Props) {
  return (
    <div style={{
      width: "100vw", height: "100vh", position: "relative", overflow: "hidden",
      background: `
        radial-gradient(ellipse 60% 40% at 20% 25%, rgba(20, 10, 70, 0.6) 0%, transparent 60%),
        radial-gradient(ellipse 50% 35% at 80% 15%, rgba(10, 20, 80, 0.5) 0%, transparent 60%),
        radial-gradient(ellipse 90% 70% at 50% 50%, #030514 20%, #000002 100%)
      `,
    }}>
      {/* Brand Header */}
      <div style={{
        position: "absolute", top: 24, left: 24, zIndex: 10,
        color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700,
        letterSpacing: 4, fontFamily: "monospace, sans-serif",
        userSelect: "none", pointerEvents: "none",
      }}>
        ORBIT SYSTEM
      </div>

      {/* Clock Display */}
      <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
        <ClockDisplay />
      </div>

      {/* Control Utility Buttons */}
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 10, display: "flex", gap: 8 }}>
        {onToggleView && (
          <button onClick={onToggleView} title="Grid view" style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.4)", borderRadius: 6, padding: "8px 14px",
            cursor: "pointer", fontSize: 13, backdropFilter: "blur(12px)",
          }}>⊞</button>
        )}
        {onLogout && (
          <button onClick={onLogout} title="Sign out" style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.4)", borderRadius: 6, padding: "8px 14px",
            cursor: "pointer", fontSize: 14, backdropFilter: "blur(12px)",
          }}>⏻</button>
        )}
      </div>

      {/* Navigation Instruction Footer */}
      <div style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, color: "rgba(255,255,255,0.25)", fontSize: 9, letterSpacing: 3,
        pointerEvents: "none", fontFamily: "monospace", userSelect: "none",
      }}>
        SELECT A PLANET TO ENGAGE
      </div>

      <Canvas
        camera={{ position: [0, 18, 54], fov: 50 }}
        style={{ position: "absolute", inset: 0 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene onNavigate={onNavigate} notifCount={notifCount} />
      </Canvas>
    </div>
  );
}