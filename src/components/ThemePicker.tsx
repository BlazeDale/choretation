import { useState, type CSSProperties } from 'react';
import { AUTO, THEMES, savedTheme, setTheme, type Theme } from '../themes';

/** A small picture of each theme: its page, a card, and a button. */
function Swatch({ theme }: { theme: Theme }) {
  const v = theme.vars;
  return (
    <span className="swatch" style={{ background: v.bg, borderColor: v.border } as CSSProperties} aria-hidden>
      <span className="swatch-card" style={{ background: v.surface, borderColor: v.border }}>
        <span className="swatch-line" style={{ background: v.text }} />
        <span className="swatch-line short" style={{ background: v.muted }} />
        <span className="swatch-pill" style={{ background: v.brand }} />
      </span>
    </span>
  );
}

export function ThemePicker() {
  const [current, setCurrent] = useState(savedTheme);
  const choose = (id: string) => {
    setTheme(id);
    setCurrent(id);
  };
  const meadow = THEMES[0];
  const night = THEMES[1];

  return (
    <div className="themes" role="group" aria-label="Theme">
      <button className="theme" aria-pressed={current === AUTO} onClick={() => choose(AUTO)}>
        <span className="swatch-pair">
          <Swatch theme={meadow} />
          <Swatch theme={night} />
        </span>
        Match my device
      </button>
      {THEMES.map((t) => (
        <button key={t.id} className="theme" aria-pressed={current === t.id} onClick={() => choose(t.id)}>
          <Swatch theme={t} />
          {t.name}
        </button>
      ))}
    </div>
  );
}
