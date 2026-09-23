/** 결정론적 시드 기반 PRNG (mulberry32) — 대결 시나리오 선택에 사용 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickIndex(seed: number, length: number): number {
  return Math.floor(mulberry32(seed)() * length) % length;
}
