import { useState } from 'react';
import type { GameState } from './game/types';
import { App } from './App';
import {
  accountHasSave,
  createAccount,
  deleteAccount,
  getAccountById,
  getCurrentAccountId,
  listAccounts,
  setCurrentAccountId,
  touchAccount,
} from './game/accounts';
import type { Account } from './game/accounts';
import { getSaveMeta, loadGame, saveGame } from './game/save';
import { createNewAdventureState } from './game/state';
import { locationLabel } from './game/content/navigation';
import { logEvent } from './game/log';
import titleArt from './assets/title-art.jpg';

type View = 'title' | 'accounts' | 'createAccount' | 'home' | 'newName' | 'game';

/**
 * 타이틀 → 계정(로그인/생성) → 새 모험/이어하기 → 게임 세션.
 */
export function Root() {
  const [view, setView] = useState<View>('title');
  const [account, setAccount] = useState<Account | null>(() => {
    const id = getCurrentAccountId();
    return id ? getAccountById(id) ?? null : null;
  });
  const [session, setSession] = useState<{ key: number; state: GameState } | null>(null);

  const login = (acc: Account) => {
    setCurrentAccountId(acc.id);
    touchAccount(acc.id);
    setAccount(acc);
    setView('home');
    logEvent('info', `로그인: ${acc.name}`);
  };

  const logout = () => {
    setCurrentAccountId(null);
    setAccount(null);
    setView('accounts');
  };

  const startSession = (state: GameState) => {
    setSession({ key: Date.now(), state });
    setView('game');
  };

  if (view === 'game' && session) {
    return (
      <App
        key={session.key}
        initialState={session.state}
        onExitToTitle={() => {
          setSession(null);
          setView('home');
        }}
      />
    );
  }

  return (
    <div className="title-root">
      <img className="title-bg" src={titleArt} alt="" draggable={false} />
      <div className="title-shade" />
      <div className="title-logo">
        <div className="title-suit">♠</div>
        <h1>BLUFF QUEST</h1>
        <p>이름 없는 승부사의 이야기</p>
      </div>

      {view === 'title' && (
        <button
          className="title-tap"
          onClick={() => setView(account ? 'home' : 'accounts')}
        >
          화면을 터치하여 시작
        </button>
      )}

      {view === 'accounts' && (
        <AccountList
          onLogin={login}
          onCreate={() => setView('createAccount')}
        />
      )}

      {view === 'createAccount' && (
        <CreateAccount
          onDone={(acc) => login(acc)}
          onBack={() => setView('accounts')}
        />
      )}

      {view === 'home' && account && (
        <AccountHome
          account={account}
          onContinue={() => {
            const { state, loadedFromSave } = loadGame();
            if (loadedFromSave) startSession(state);
          }}
          onNewAdventure={() => setView('newName')}
          onLogout={logout}
        />
      )}

      {view === 'newName' && account && (
        <NewAdventure
          onStart={(name) => {
            const state = createNewAdventureState(name);
            saveGame(state);
            touchAccount(account.id);
            logEvent('info', `새 모험 시작: ${name}`);
            startSession(state);
          }}
          onBack={() => setView('home')}
        />
      )}
    </div>
  );
}

function AccountList(props: { onLogin: (a: Account) => void; onCreate: () => void }) {
  const [accounts, setAccounts] = useState(() => listAccounts());
  return (
    <div className="title-panel">
      <h2>계정 선택</h2>
      <p className="dim">이 기기에 저장된 승부사 계정입니다.</p>
      {accounts.length === 0 && <p className="dim empty-line">아직 계정이 없습니다. 새 계정을 만들어 주세요.</p>}
      <div className="account-list">
        {accounts.map((a) => (
          <div key={a.id} className="account-row">
            <button className="account-main" onClick={() => props.onLogin(a)}>
              <b>{a.name}</b>
              <span className="dim">
                {accountHasSave(a.id) ? '진행 중인 모험 있음' : '새 계정'} · 마지막 접속{' '}
                {new Date(a.lastPlayedAt).toLocaleDateString()}
              </span>
            </button>
            <button
              className="account-del"
              aria-label={`${a.name} 계정 삭제`}
              onClick={() => {
                if (window.confirm(`'${a.name}' 계정과 그 세이브를 삭제할까요? 되돌릴 수 없습니다.`)) {
                  deleteAccount(a.id);
                  setAccounts(listAccounts());
                }
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button className="gold" onClick={props.onCreate}>
        + 새 계정 만들기
      </button>
    </div>
  );
}

function CreateAccount(props: { onDone: (a: Account) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const valid = name.trim().length > 0;
  return (
    <div className="title-panel">
      <h2>새 계정 만들기</h2>
      <p className="dim">계정 이름은 이 기기에서 세이브를 구분하는 데 쓰입니다.</p>
      <input
        className="title-input"
        value={name}
        maxLength={20}
        placeholder="계정 이름"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) props.onDone(createAccount(name));
        }}
        autoFocus
      />
      <button className="gold" disabled={!valid} onClick={() => props.onDone(createAccount(name))}>
        만들고 로그인
      </button>
      <button onClick={props.onBack}>뒤로</button>
    </div>
  );
}

function AccountHome(props: {
  account: Account;
  onContinue: () => void;
  onNewAdventure: () => void;
  onLogout: () => void;
}) {
  const hasSave = accountHasSave(props.account.id);
  const summary = hasSave ? loadGame() : null;
  const meta = hasSave ? getSaveMeta() : null;
  const s = summary?.loadedFromSave ? summary.state : null;

  return (
    <div className="title-panel">
      <h2>{props.account.name}</h2>
      {s ? (
        <div className="save-summary">
          <b>♠ {s.player.name}</b>
          <span className="dim">📍 {locationLabel(s.player.location)}</span>
          <span className="dim">💰 {s.player.gold}닢 · 대결 {s.career.duels}회</span>
          {meta && <span className="dim">마지막 저장 {new Date(meta.savedAt).toLocaleString()}</span>}
        </div>
      ) : (
        <p className="dim">아직 시작한 모험이 없습니다.</p>
      )}
      {s && (
        <button className="gold" onClick={props.onContinue}>
          이어하기
        </button>
      )}
      <button
        className={s ? '' : 'gold'}
        onClick={() => {
          if (
            !s ||
            window.confirm('새 모험을 시작하면 이 계정의 현재 진행이 사라집니다. 계속할까요?')
          ) {
            props.onNewAdventure();
          }
        }}
      >
        새 모험
      </button>
      <button onClick={props.onLogout}>계정 전환</button>
    </div>
  );
}

function NewAdventure(props: { onStart: (name: string) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const finalName = name.trim() || '이름 없는 승부사';
  return (
    <div className="title-panel">
      <h2>승부사의 이름</h2>
      <p className="dim">
        아직 아무도 모르는 이름. 고블린 시장에서 처음으로 불리게 될 이름을 정하세요.
      </p>
      <input
        className="title-input"
        value={name}
        maxLength={12}
        placeholder="이름 없는 승부사"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') props.onStart(finalName);
        }}
        autoFocus
      />
      <button className="gold" onClick={() => props.onStart(finalName)}>
        모험 시작
      </button>
      <button onClick={props.onBack}>뒤로</button>
    </div>
  );
}
