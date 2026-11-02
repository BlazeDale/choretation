import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HOME } from './generator';
import { loadHomeDraft, saveHomeDraft, sameHome } from './homeDraft';
import type { HomeConfig } from './types';

describe('sameHome', () => {
  it('ignores the order the database returns fields in', () => {
    const reordered = Object.fromEntries(Object.entries(DEFAULT_HOME).reverse()) as unknown as HomeConfig;
    expect(sameHome(DEFAULT_HOME, reordered)).toBe(true);
    const rooms = DEFAULT_HOME.rooms.map((r) => Object.fromEntries(Object.entries(r).reverse())) as HomeConfig['rooms'];
    expect(sameHome(DEFAULT_HOME, { ...DEFAULT_HOME, rooms })).toBe(true);
  });

  it('notices a real change', () => {
    expect(sameHome(DEFAULT_HOME, { ...DEFAULT_HOME, floors: DEFAULT_HOME.floors + 1 })).toBe(false);
    expect(sameHome(DEFAULT_HOME, { ...DEFAULT_HOME, rooms: DEFAULT_HOME.rooms.slice(1) })).toBe(false);
    expect(sameHome(DEFAULT_HOME, { ...DEFAULT_HOME, pets: { dogs: 1 } })).toBe(false);
  });
});

describe('home draft', () => {
  const stored = new Map<string, string>();

  beforeEach(() => {
    stored.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => stored.get(k) ?? null,
      setItem: (k: string, v: string) => stored.set(k, v),
      removeItem: (k: string) => stored.delete(k),
    });
  });

  it('survives a reload, and goes when cleared', () => {
    expect(loadHomeDraft()).toBeNull();
    saveHomeDraft(DEFAULT_HOME);
    expect(sameHome(loadHomeDraft()!, DEFAULT_HOME)).toBe(true);
    saveHomeDraft(null);
    expect(loadHomeDraft()).toBeNull();
  });

  it('ignores anything unreadable', () => {
    stored.set('choretation-home-draft', 'not json');
    expect(loadHomeDraft()).toBeNull();
    stored.set('choretation-home-draft', '{"floors":2}');
    expect(loadHomeDraft()).toBeNull();
  });
});
