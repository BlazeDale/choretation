import { useState } from 'react';
import { AVATARS, DEFAULT_AVATAR, portraitUrl } from '../choreArt';

/** Which character appears doing this person's chores, on screen and in print. */
export function AvatarPicker({ value, onChange }: { value?: string; onChange: (avatar: string) => void }) {
  const current = value ?? DEFAULT_AVATAR;
  // An avatar whose pictures aren't on this site (e.g. kept out of the public build) isn't offered.
  const [missing, setMissing] = useState<Set<string>>(new Set());
  return (
    <div className="avatars" role="group" aria-label="Avatar">
      <span className="unit">Avatar:</span>
      {AVATARS.filter((a) => !missing.has(a.id)).map((a) => (
        <button key={a.id} className="avatar" aria-pressed={current === a.id} onClick={() => onChange(a.id)} title={a.name}>
          <img
            className="portrait"
            src={portraitUrl(a.id)}
            alt=""
            onError={() => setMissing((m) => new Set(m).add(a.id))}
          />
          <span>{a.name}</span>
        </button>
      ))}
    </div>
  );
}
