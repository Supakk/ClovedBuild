import { useEffect, useState } from 'react';
import { getShot, type ShotKey } from '../lib/house/snapshots';

interface Props {
  shot: ShotKey;
  alt: string;
  /** Width / height of the picture box, e.g. 1.18 */
  ratio: number;
  className?: string;
}

/** A still render of the 3D house, drawn in the browser once and shown as an image. */
export default function HouseShot({ shot, alt, ratio, className = '' }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getShot(shot).then((s) => { if (!alive) return; if (s) setSrc(s); else setFailed(true); });
    return () => { alive = false; };
  }, [shot]);

  return (
    <div className={`relative w-full max-w-full ${className}`} style={{ aspectRatio: String(ratio) }}>
      {src ? <img src={src} alt={alt} className="animate-fade-in absolute inset-0 size-full object-contain" /> : !failed && <div className="skeleton absolute inset-[12%] rounded-3xl opacity-60" />}
      {failed && <div className="absolute inset-0 grid place-items-center text-center text-sm font-semibold text-muted">3D preview needs WebGL</div>}
    </div>
  );
}
