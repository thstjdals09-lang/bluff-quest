import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialState, createNewAdventureState, reducer } from '../state';
import { getInteraction, resolveDialogueNode } from '../content/dialogues';
import { importSave } from '../save';

/** 대화 선택지의 효과를 리듀서에 적용하는 테스트 헬퍼 */
function choose(state: GameState, entityId: string, textIncludes: string, nodeId?: string): GameState {
  const tree = getInteraction(entityId, state);
  const node = tree.nodes[nodeId ?? tree.entry];
  const choice = node.choices.find((c) => c.text.includes(textIncludes));
  if (!choice) throw new Error(`choice not found: ${textIncludes} in ${node.choices.map((c) => c.text).join(' | ')}`);
  return (choice.effects ?? []).reduce(reducer, state);
}

describe('프롤로그 (새 모험)', () => {
  it('새 모험은 시장으로 가는 길에서 이름과 함께 시작한다', () => {
    const s = createNewAdventureState('카이');
    expect(s.player.name).toBe('카이');
    expect(s.player.location).toBe('market_road');
    expect(s.quests.q_prologue.stage).toBe('road');
    expect(s.inventory).toEqual([]);
  });

  it('카드 발견 → 상인 반응 → 시장 입장까지 진행된다', () => {
    let s = createNewAdventureState('카이');
    s = choose(s, 'old_card', '주워서');
    expect(s.inventory).toContain('old_spade_card');
    expect(s.discovered).toContain('old_spade_card');
    expect(s.quests.q_prologue.stage).toBe('card');

    s = choose(s, 'gate_merchant', '길에서 주웠다');
    expect(s.flags.gate_merchant_met).toBe(true);
    expect(s.flags.gate_merchant_answer).toBe('told');
    expect(s.quests.q_prologue.stage).toBe('merchant');

    s = choose(s, 'market_gate', '시장으로 들어간다');
    expect(s.player.location).toBe('market');
    expect(s.quests.q_prologue.stage).toBe('done');
    expect(s.flags.prologue_done).toBe(true);
    // 기존 메인 퀘스트는 그대로 시작 상태 — 첫 대결은 강제되지 않는다
    expect(s.quests.q_invitation.stage).toBe('start');
    expect(s.activeEncounter).toBeNull();
  });

  it('선택 효과로 분기 조건이 바뀌어도 다음 노드(상인의 말 바꾸기)가 표시된다', () => {
    let s = createNewAdventureState('카이');
    s = choose(s, 'old_card', '주워서');
    const before = getInteraction('gate_merchant', s);
    s = choose(s, 'gate_merchant', '길에서 주웠다');
    // 효과 적용 후 최신 트리에는 'backpedal' 노드가 없다 (이미 만난 상태의 짧은 대사로 바뀜)
    expect(getInteraction('gate_merchant', s).nodes.backpedal).toBeUndefined();
    // 스냅샷을 통해 대화가 이어진다
    const node = resolveDialogueNode('gate_merchant', s, 'backpedal', before);
    expect(node.text).toContain('그런 건 처음 봐');
  });

  it('핀의 첫 만남 분기(간파)도 스냅샷으로 이어진다', () => {
    let s = createInitialState();
    s = { ...s, flags: { ...s.flags, pier_rumor: true } };
    const before = getInteraction('fin', s);
    s = choose(s, 'fin', '낚시꾼');
    const node = resolveDialogueNode('fin', s, 'called', before);
    expect(node.text).toContain('반은 낚시였다');
  });

  it('카드를 줍지 않아도 시장에 들어갈 수 있다 (진행이 막히지 않음)', () => {
    let s = createNewAdventureState('카이');
    // 카드 없이 상인은 평범한 호객만 한다
    const merchant = getInteraction('gate_merchant', s);
    expect(merchant.nodes[merchant.entry].text).not.toContain('어디서 났어');
    s = choose(s, 'market_gate', '시장으로 들어간다');
    expect(s.player.location).toBe('market');
    expect(s.flags.prologue_done).toBe(true);
    expect(s.inventory).not.toContain('old_spade_card');
  });

  it('기존 플레이어: 카드를 소급 지급하지 않고, 시장 출구로 나가 직접 발견할 수 있다', () => {
    let s = createInitialState('기존 여행자');
    delete (s.quests as Record<string, unknown>).q_prologue;
    expect(s.inventory).not.toContain('old_spade_card');
    s = choose(s, 'market_exit', '바깥 길로');
    expect(s.player.location).toBe('market_road');
    s = choose(s, 'old_card', '주워서');
    expect(s.inventory).toContain('old_spade_card');
    // 이미 도입부를 지난 플레이어에게 프롤로그 퀘스트가 새로 생기지 않는다
    expect(s.quests.q_prologue).toBeUndefined();
  });

  it('v4(Phase 5) 세이브는 v5로 이전되며 이름은 기본값, 진행은 보존된다', () => {
    const v4 = {
      ...createInitialState(),
      version: 4,
      player: { location: 'port_docks', x: 3, y: 6, gold: 12 },
      quests: { q_invitation: { stage: 'done', completed: ['start', 'boxes'] }, q_night_pier: { stage: 'wager', completed: ['arrive'] } },
      flags: { found_invitation: true, chip_done: 'warm' },
    };
    const restored = importSave(JSON.stringify(v4));
    expect(restored).not.toBeNull();
    expect(restored!.version).toBe(5);
    expect(restored!.player.name).toBe('이름 없는 승부사');
    expect(restored!.player.location).toBe('port_docks');
    expect(restored!.quests.q_night_pier.stage).toBe('wager');
    expect(restored!.flags.chip_done).toBe('warm');
    expect(restored!.inventory).not.toContain('old_spade_card');
  });
});

// ── 계정 (localStorage 목) ──
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

describe('로컬 계정', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it('계정 도입 전 세이브는 기본 계정으로 승계된다', async () => {
    const { listAccounts, accountSaveKey, LEGACY_SAVE_KEY } = await import('../accounts');
    localStorage.setItem(LEGACY_SAVE_KEY, '{"legacy":true}');
    const accounts = listAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toContain('기존 세이브');
    expect(localStorage.getItem(accountSaveKey(accounts[0].id))).toBe('{"legacy":true}');
    expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull();
    // 두 번째 호출에서 중복 승계하지 않는다
    expect(listAccounts()).toHaveLength(1);
  });

  it('계정별로 세이브가 분리된다', async () => {
    const { createAccount, setCurrentAccountId } = await import('../accounts');
    const { saveGame, loadGame } = await import('../save');
    const a = createAccount('A');
    const b = createAccount('B');
    setCurrentAccountId(a.id);
    saveGame(createNewAdventureState('에이'));
    setCurrentAccountId(b.id);
    expect(loadGame().loadedFromSave).toBe(false);
    saveGame(createNewAdventureState('비'));
    setCurrentAccountId(a.id);
    expect(loadGame().state.player.name).toBe('에이');
    setCurrentAccountId(b.id);
    expect(loadGame().state.player.name).toBe('비');
  });
});
