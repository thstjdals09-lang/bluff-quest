import type { FlagValue, GameState } from '../types';

/**
 * 수집한 정보 기록 — 일지에 표시된다.
 * 사실(FACT) / 주장(CLAIM) / 소문(RUMOR) / 추정(INFERENCE)을 구분해,
 * NPC의 말을 확인된 사실처럼 다루지 않는다 (스토리 바이블 원칙).
 * 아직 발견하지 않은 비밀(SECRET)은 여기 정의하지 않는다.
 */

export type RecordKind = 'fact' | 'claim' | 'rumor' | 'inference';

export const RECORD_KIND_LABELS: Record<RecordKind, string> = {
  fact: '사실',
  claim: '주장',
  rumor: '소문',
  inference: '추정',
};

export interface StoryRecordDef {
  flag: string;
  /** 지정 시 플래그 값이 일치할 때만 표시 */
  requireValue?: FlagValue;
  kind: RecordKind;
  text: string;
}

export const STORY_RECORDS: StoryRecordDef[] = [
  // 고블린 시장
  { flag: 'read_manifest', kind: 'fact', text: '시장 게시판: 항구에서 밀수 인장(⚓)이 찍힌 도난 화물이 사라졌다는 공고를 봤다.' },
  { flag: 'chip_refused', kind: 'fact', text: '돈이라면 사족을 못 쓰는 그리즐이, 좌판의 검은 칩만은 값도 듣지 않고 팔기를 거절했다.' },
  { flag: 'chip_asked_mira', kind: 'claim', text: '미라: "검은 칩은 그리즐의 사라진 친구가 맡긴 것이다. 그리즐은 약속을 지키는 중이다."' },
  { flag: 'mira_chip_flinch', kind: 'inference', text: '미라는 검은 칩 이야기에 표정이 흔들렸다. 처음 보는 물건을 대하는 반응이 아니었다.' },
  { flag: 'ledger_clue', kind: 'inference', text: '창고의 장부 조각: 그리즐이 누군가와 거래한 기록. 서명 자리는 일부러 지워져 있었고, 여백에 스페이드 낙서가 있다.' },
  { flag: 'chip_done', requireValue: 'warm', kind: 'fact', text: '그리즐이 직접 말했다: 검은 칩은 사라진 친구가 "누가 찾아와도 모른다고 해"라며 맡긴 것이다.' },
  { flag: 'chip_done', requireValue: 'cold', kind: 'fact', text: '그리즐이 마지못해 인정했다: 검은 칩은 사라진 친구와의 약속으로 지키는 물건이다.' },
  { flag: 'mira_slip', kind: 'inference', text: '미라가 승부판에서 쓰는 말("콜", "폴드", "레이즈")을 무심코 흘렸다. 약초상의 말버릇이 아니다.' },
  { flag: 'mira_admitted', kind: 'fact', text: '미라가 인정했다: 한때 여러 지역을 돌며 판을 진행하던 딜러였다. 그만둔 이유는 말하지 않았다.' },
  // 사기꾼들의 항구
  { flag: 'pier_rumor', kind: 'rumor', text: '부두 게시판: 이름난 승부사들이 하나둘 소식을 끊고 있다는 벽보가 유독 많다.' },
  { flag: 'cargo_checked', requireValue: 'linked', kind: 'inference', text: '부두의 밀수 화물에 찍힌 닻(⚓) 인장은 고블린 시장 도난 화물 공고의 문양과 같다. 두 지역이 밀수로 이어져 있는 듯하다.' },
  { flag: 'fin_bluff_called', kind: 'fact', text: '정보상 올드 핀은 게시판 소문으로 손님을 떠보는 낚시꾼이다. 그의 넘겨짚기를 간파해 한 수 접게 만들었다.' },
  { flag: 'invitation_confirmed_to_fin', kind: 'fact', text: '핀의 넘겨짚기에 말려들어, 초대장을 가졌다는 사실을 스스로 확인해 주고 말았다.' },
  { flag: 'night_pier_hint', kind: 'claim', text: '핀: "달 없는 밤, 부두 끝에서 비밀 경기가 열린다. 자리는 초대장 수만큼."' },
  { flag: 'invitation_meaning_known', requireValue: 'claim', kind: 'claim', text: '핀: "초대장에는 이름이 없다. 종이를 쥔 사람이 곧 그 자리다." — 아직 그의 말일 뿐이다.' },
  { flag: 'invitation_meaning_known', requireValue: 'fact', kind: 'fact', text: '초대장 뒷면에서 직접 확인했다: "당신에게 아직 끝나지 않은 승부가 있습니다." 받는 이의 이름은 없다. 초대장은 사람이 아니라 \'자리\'에 보내진 것이다.' },
  { flag: 'invitation_shown', kind: 'fact', text: '초대장을 올드 핀에게 보여줬다. 정보를 얻었지만, 부두에 소문이 돌기 시작했다.' },
];

export function getDiscoveredRecords(state: GameState): { kind: RecordKind; text: string }[] {
  return STORY_RECORDS.filter((r) => {
    const v = state.flags[r.flag];
    if (v === undefined || v === false) return false;
    if (r.requireValue !== undefined) return v === r.requireValue;
    return true;
  }).map((r) => ({ kind: r.kind, text: r.text }));
}
