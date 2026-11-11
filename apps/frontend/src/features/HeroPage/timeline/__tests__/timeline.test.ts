import { describe, expect, it } from 'vitest';

import { at, HOLOGRAM_GATE_END, PLATFORM_TIMELINE } from '../choreography';
import { heroToPage, pageToHero, type HeroWindow } from '../frames';

const { steam, xbox, playstation, unified } = PLATFORM_TIMELINE;
const mid = ([start, end]: [number, number]) => (start + end) / 2;

describe('at(h).platform', () => {
  it.each([
    ['page top', 0, null],
    ['before activation', 0.29, null],
    ['activation start, before steam', 0.39, null],
    ['steam start (inclusive)', steam[0], 'steam'],
    ['inside steam', mid(steam), 'steam'],
    ['steam end (exclusive), gap', steam[1], null],
    ['inside xbox', mid(xbox), 'xbox'],
    ['inside playstation', mid(playstation), 'playstation'],
    ['unified start', unified[0], 'unified'],
    ['just before the gate', HOLOGRAM_GATE_END - 0.001, 'unified'],
    ['at the gate (still inside unified window)', HOLOGRAM_GATE_END, null],
    ['past the gate', 0.81, null],
    ['end of hero', 1, null],
  ] as const)('%s → %s', (_label, h, expected) => {
    expect(at(h).platform).toBe(expected);
  });
});

describe('at(h).display', () => {
  it.each([
    ['before activation', 0.1, 0],
    ['activation start, before steam', 0.35, 0],
    ['inside steam', mid(steam), 1],
    ['gap after steam holds steam', (steam[1] + xbox[0]) / 2, 1],
    ['inside xbox', mid(xbox), 2],
    ['gap after xbox holds xbox', (xbox[1] + playstation[0]) / 2, 2],
    ['inside playstation', mid(playstation), 3],
    ['inside unified', unified[0] + 0.01, 4],
    ['at the gate', HOLOGRAM_GATE_END, 0],
    ['end of hero', 1, 0],
  ] as const)('%s → %s', (_label, h, expected) => {
    expect(at(h).display).toBe(expected);
  });
});

describe('frame conversion', () => {
  const window: HeroWindow = { start: 0.1, end: 0.5 };

  it.each([0, 0.25, 0.5, 0.75, 1])('round-trips hero %s', (h) => {
    expect(pageToHero(heroToPage(h, window), window)).toBeCloseTo(h);
  });

  it.each([
    ['hero start', 0, 0.1],
    ['hero middle', 0.5, 0.3],
    ['hero end', 1, 0.5],
  ] as const)('heroToPage: %s', (_label, h, page) => {
    expect(heroToPage(h, window)).toBeCloseTo(page);
  });

  it.each([
    ['before the hero clamps to 0', 0, 0],
    ['after the hero clamps to 1', 0.9, 1],
  ] as const)('pageToHero: %s', (_label, page, h) => {
    expect(pageToHero(page, window)).toBe(h);
  });

  it('a zero-width window maps everything to 0', () => {
    expect(pageToHero(0.4, { start: 0.3, end: 0.3 })).toBe(0);
  });
});
