import type { CSSProperties } from "react"
import {
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Droplets,
  GraduationCap,
  Lightbulb,
  MapPin,
  Armchair,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react"

/*
 * Latar animasi dekoratif (murni tampilan).
 * Tidak memiliki state, event, atau logika apa pun — aman ditambahkan
 * tanpa mengubah fungsi aplikasi. aria-hidden agar diabaikan pembaca layar.
 */
const BUBBLES = [
  { Icon: Wrench, x: 4, s: 46, d: 19, delay: -0 },
  { Icon: Lightbulb, x: 14, s: 38, d: 23, delay: -6 },
  { Icon: Droplets, x: 24, s: 30, d: 17, delay: -11 },
  { Icon: Wifi, x: 34, s: 52, d: 25, delay: -3 },
  { Icon: Zap, x: 44, s: 34, d: 20, delay: -14 },
  { Icon: Armchair, x: 54, s: 44, d: 22, delay: -8 },
  { Icon: Building2, x: 63, s: 56, d: 27, delay: -17 },
  { Icon: Sparkles, x: 72, s: 36, d: 18, delay: -2 },
  { Icon: Camera, x: 81, s: 48, d: 24, delay: -12 },
  { Icon: MapPin, x: 90, s: 32, d: 19, delay: -7 },
  { Icon: CheckCircle2, x: 9, s: 30, d: 26, delay: -20 },
  { Icon: ClipboardList, x: 29, s: 40, d: 21, delay: -15 },
  { Icon: RefreshCw, x: 49, s: 28, d: 16, delay: -5 },
  { Icon: ShieldCheck, x: 68, s: 40, d: 28, delay: -22 },
  { Icon: GraduationCap, x: 86, s: 54, d: 30, delay: -9 },
]

export function AmbientBackground() {
  return (
    <div className="cf-ambient" aria-hidden="true">
      <div className="cf-ambient-grid" />
      <span className="cf-ambient-ring cf-ambient-ring-1" />
      <span className="cf-ambient-ring cf-ambient-ring-2" />
      {BUBBLES.map(({ Icon, x, s, d, delay }, i) => (
        <i
          key={i}
          className="cf-ambient-bubble"
          style={
            {
              "--x": `${x}%`,
              "--s": `${s}px`,
              "--d": `${d}s`,
              "--delay": `${delay}s`,
              "--r": `${i % 2 ? 180 : -180}deg`,
            } as CSSProperties
          }
        >
          <Icon />
        </i>
      ))}
    </div>
  )
}
