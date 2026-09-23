import { describe, expect, it } from 'vitest';
import { applyInfoAction, chooseBox, getScenario, startEncounter, INFO_ACTION_LIMIT } from '../encounter';
import { GOBLIN_SCENARIOS } from '../content/scenarios';

describe('대결 엔진', () => {
  it('같은 시드는 항상 같은 시나리오를 선택한다 (결정론)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const a = startEncounter(seed, null);
      const b = startEncounter(seed, null);
      expect(a.scenarioId).toBe(b.scenarioId);
    }
  });

  it('시나리오 풀에 진실 주장과 거짓 주장이 모두 존재한다', () => {
    const truths = GOBLIN_SCENARIOS.filter((s) => s.statement.isTrue);
    const lies = GOBLIN_SCENARIOS.filter((s) => !s.statement.isTrue);
    expect(truths.length).toBeGreaterThan(0);
    expect(lies.length).toBeGreaterThan(0);
  });

  it('모든 시나리오의 내부 상태가 논리적으로 일관된다', () => {
    for (const s of GOBLIN_SCENARIOS) {
      // 보물은 정확히 하나
      expect(s.boxes.filter((b) => b === 'treasure')).toHaveLength(1);
      const treasureIdx = s.boxes.indexOf('treasure');
      // 주장 "왼쪽에는 보물이 없다"의 진위가 실제 상자 내용과 일치
      expect(s.statement.isTrue).toBe(treasureIdx !== 0);
      // NPC가 위치를 알면 믿는 위치는 실제 위치와 일치해야 함
      if (s.npcKnowsLocation) expect(s.npcBelievedIndex).toBe(treasureIdx);
      // 4가지 정보 행동 단서가 모두 정의됨
      expect(Object.keys(s.clues)).toHaveLength(4);
    }
  });

  it('정보 행동은 제한 횟수까지만 가능하고 중복은 무시된다', () => {
    let enc = startEncounter(1, null);
    enc = { ...enc, phase: 'info' };
    enc = applyInfoAction(enc, 'observe');
    enc = applyInfoAction(enc, 'observe'); // 중복 — 무시
    expect(enc.usedActions).toEqual(['observe']);
    enc = applyInfoAction(enc, 'ask_boxes');
    enc = applyInfoAction(enc, 'inspect');
    enc = applyInfoAction(enc, 'ask_motive'); // 4번째 — 제한 초과로 무시
    expect(enc.usedActions).toHaveLength(INFO_ACTION_LIMIT);
  });

  it('상자 선택 결과는 시작 시 확정된 시나리오 데이터로만 판정된다', () => {
    const enc = { ...startEncounter(3, null), phase: 'info' as const };
    const scenario = getScenario(enc);
    const treasureIdx = scenario.boxes.indexOf('treasure') as 0 | 1 | 2;
    const win = chooseBox(enc, treasureIdx);
    expect(win.result).toBe('win');
    expect(win.phase).toBe('resolved');
    const loseIdx = ((treasureIdx + 1) % 3) as 0 | 1 | 2;
    const lose = chooseBox({ ...enc }, loseIdx);
    expect(lose.result).toBe('lose');
  });

  it('선택 이후에는 추가 선택/행동이 상태를 바꾸지 않는다', () => {
    const enc = { ...startEncounter(3, null), phase: 'info' as const };
    const resolved = chooseBox(enc, 0);
    expect(chooseBox(resolved, 1)).toBe(resolved);
    expect(applyInfoAction(resolved, 'observe')).toBe(resolved);
  });
});
