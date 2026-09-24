import type { ItemDef } from '../game/types';
import { itemCrest } from '../game/content/bag';

/**
 * 아이템 그림 — 이모지를 쓰되, 이 기기 글꼴이 그 이모지를 그리지 못하면(빈 네모 ▯)
 * 아이템 아이디로 정해지는 SVG 문장으로 바꿔 그린다.
 */

const cache = new Map<string, boolean>();

/** 개발자 모드 검수용: ?dev&glyphfail — 모든 이모지를 그릴 수 없는 것으로 취급 */
function forcedFail(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.has('dev') && q.has('glyphfail');
  } catch {
    return false;
  }
}

/**
 * 캔버스에 글자를 그려, 어떤 글꼴에도 없는 코드포인트(U+10FFFD)를 그린 결과와 같거나 비어 있으면 실패로 본다.
 * 캔버스를 쓸 수 없는 환경에서는 그릴 수 있다고 가정한다(기존 동작).
 */
export function canRenderGlyph(glyph: string): boolean {
  if (forcedFail()) return false;
  const hit = cache.get(glyph);
  if (hit !== undefined) return hit;
  let ok = true;
  try {
    const size = 40;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
      const draw = (s: string) => {
        ctx.clearRect(0, 0, size, size);
        ctx.font = `30px ${family}`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#000';
        ctx.fillText(s, 2, 2);
        return ctx.getImageData(0, 0, size, size).data;
      };
      const a = draw(glyph);
      const tofu = draw('\u{10FFFD}');
      let blank = true;
      let same = true;
      for (let i = 0; i < a.length; i++) {
        if (blank && i % 4 === 3 && a[i] > 0) blank = false;
        if (same && a[i] !== tofu[i]) same = false;
        if (!blank && !same) break;
      }
      ok = !blank && !same;
    }
  } catch {
    ok = true;
  }
  cache.set(glyph, ok);
  return ok;
}

const SHAPES: Record<ReturnType<typeof itemCrest>['shape'], string> = {
  coin: 'M32 6a26 26 0 1 0 0.01 0Z',
  shield: 'M32 5 L55 13 V31 C55 45 45 54 32 59 C19 54 9 45 9 31 V13 Z',
  diamond: 'M32 4 L58 32 L32 60 L6 32 Z',
  hex: 'M32 5 L55 18 V46 L32 59 L9 46 V18 Z',
};

export function ItemCrestSvg(props: { item: Pick<ItemDef, 'id' | 'name'> }) {
  const c = itemCrest(props.item);
  const gid = `crest-${props.item.id}`;
  return (
    <svg className="item-crest" viewBox="0 0 64 64" aria-hidden="true" data-crest={c.shape}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${c.hue} 45% 42%)`} />
          <stop offset="1" stopColor={`hsl(${c.hue} 50% 20%)`} />
        </linearGradient>
      </defs>
      <path d={SHAPES[c.shape]} fill={`url(#${gid})`} stroke="#f0c878" strokeWidth="2.5" />
      <path d={SHAPES[c.shape]} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1" transform="translate(32 32) scale(0.82) translate(-32 -32)" />
      <text x="32" y="33" textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="700" fill="#fdf0d2" stroke="rgba(0,0,0,0.5)" strokeWidth="0.8">
        {c.letter}
      </text>
    </svg>
  );
}

/** 이모지가 그려지면 이모지, 아니면 문장. `data-glyph`로 어느 쪽인지 드러낸다(검수용). */
export function ItemGlyph(props: { item: ItemDef; className?: string }) {
  const ok = canRenderGlyph(props.item.icon);
  return (
    <span className={`item-glyph ${props.className ?? ''}`} data-glyph={ok ? 'emoji' : 'crest'}>
      {ok ? <span className="item-emoji">{props.item.icon}</span> : <ItemCrestSvg item={props.item} />}
    </span>
  );
}
