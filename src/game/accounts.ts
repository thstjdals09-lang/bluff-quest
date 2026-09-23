/**
 * 기기 내 로컬 프로필 계정 시스템.
 *
 * 이 게임은 GitHub Pages 정적 호스팅으로 배포되어 서버가 없으므로,
 * "계정"은 이 기기(브라우저)에 저장되는 프로필이며 계정마다 세이브 슬롯을 가진다.
 * - 계정 생성 = 프로필 이름 등록
 * - 로그인 = 프로필 선택
 * - 기존(계정 도입 전) 세이브는 최초 실행 시 자동으로 기본 계정에 승계된다.
 */

import { logEvent } from './log';

export interface Account {
  id: string;
  name: string;
  createdAt: string;
  lastPlayedAt: string;
}

const ACCOUNTS_KEY = 'bq_accounts';
const CURRENT_KEY = 'bq_current_account';
/** 계정 도입(Phase 6) 이전의 단일 세이브 키 */
export const LEGACY_SAVE_KEY = 'bluff_quest_save';
export const LEGACY_META_KEY = 'bluff_quest_save_meta';

export function accountSaveKey(accountId: string): string {
  return `bluff_quest_save::${accountId}`;
}
export function accountMetaKey(accountId: string): string {
  return `bluff_quest_save_meta::${accountId}`;
}

function readAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Account => typeof a === 'object' && a !== null && typeof (a as Account).id === 'string',
    );
  } catch {
    return [];
  }
}

function writeAccounts(accounts: Account[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    logEvent('error', `계정 저장 실패: ${String(e)}`);
  }
}

export function listAccounts(): Account[] {
  adoptLegacySave();
  return readAccounts().sort((a, b) => (b.lastPlayedAt > a.lastPlayedAt ? 1 : -1));
}

export function createAccount(name: string): Account {
  const trimmed = name.trim().slice(0, 20) || '이름 없는 승부사';
  const account: Account = {
    id: `acc_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: trimmed,
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
  };
  writeAccounts([...readAccounts(), account]);
  logEvent('info', `계정 생성: ${trimmed}`);
  return account;
}

export function touchAccount(accountId: string): void {
  const accounts = readAccounts();
  const idx = accounts.findIndex((a) => a.id === accountId);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], lastPlayedAt: new Date().toISOString() };
    writeAccounts(accounts);
  }
}

export function deleteAccount(accountId: string): void {
  writeAccounts(readAccounts().filter((a) => a.id !== accountId));
  try {
    localStorage.removeItem(accountSaveKey(accountId));
    localStorage.removeItem(accountMetaKey(accountId));
  } catch {
    /* ignore */
  }
}

export function getCurrentAccountId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function setCurrentAccountId(accountId: string | null): void {
  try {
    if (accountId === null) localStorage.removeItem(CURRENT_KEY);
    else localStorage.setItem(CURRENT_KEY, accountId);
  } catch {
    /* ignore */
  }
}

export function getAccountById(accountId: string): Account | undefined {
  return readAccounts().find((a) => a.id === accountId);
}

export function accountHasSave(accountId: string): boolean {
  try {
    return localStorage.getItem(accountSaveKey(accountId)) !== null;
  } catch {
    return false;
  }
}

/**
 * 계정 도입 전의 단일 세이브를 기본 계정으로 승계한다.
 * 기존 플레이어는 타이틀에서 이 계정을 선택해 그대로 이어 할 수 있다.
 */
export function adoptLegacySave(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacy) return;
    const account = createAccount('여행자 (기존 세이브)');
    localStorage.setItem(accountSaveKey(account.id), legacy);
    const legacyMeta = localStorage.getItem(LEGACY_META_KEY);
    if (legacyMeta) localStorage.setItem(accountMetaKey(account.id), legacyMeta);
    localStorage.removeItem(LEGACY_SAVE_KEY);
    localStorage.removeItem(LEGACY_META_KEY);
    logEvent('info', '기존 세이브를 "여행자 (기존 세이브)" 계정으로 승계했습니다.');
  } catch (e) {
    logEvent('error', `기존 세이브 승계 실패: ${String(e)}`);
  }
}
