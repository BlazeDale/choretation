import { useState } from 'react';
import { artUrls } from '../choreArt';
import type { Location } from '../locations';

export function LocationMark({ loc }: { loc?: Location }) {
  if (!loc) return null;
  return (
    <span className="loc">
      <PlaceImg loc={loc} />
      {loc.n && <sub>{loc.n}</sub>}
    </span>
  );
}

/** Outline drawing of the place, or a greyed emoji until that drawing exists. */
function PlaceImg({ loc }: { loc: Location }) {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className="loc-emoji">{loc.emoji}</span>;
  return <img src={`${import.meta.env.BASE_URL}coloring/places/${loc.key}.png`} alt="" onError={() => setMissing(true)} />;
}

/** Picture of someone doing the chore, falling back to the plain drawing, then a sparkle. */
export function ArtImg({ artKey: key }: { artKey: string }) {
  const urls = artUrls(key);
  const [tries, setTries] = useState(0);
  if (tries >= urls.length) {
    return (
      <svg viewBox="0 0 24 24" className="art-img" aria-hidden>
        <path d="M12 2 Q12 12 22 12 Q12 12 12 22 Q12 12 2 12 Q12 12 12 2Z" fill="none" stroke="#2b2a33" strokeWidth="1.4" />
      </svg>
    );
  }
  return <img className="art-img" src={urls[tries]} alt="" onError={() => setTries((t) => t + 1)} />;
}
