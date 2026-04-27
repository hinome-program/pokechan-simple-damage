/**
 * ポケチャンシンプルダメ計 | Battle Arena Edition
 * app.js — 物理/特殊モード切替 + 努力値(EV)対応 + ランク補正
 *
 * ■ 攻撃モード
 *   physical : 攻撃側=こうげき, 防御側=ぼうぎょ
 *   special  : 攻撃側=とくこう, 防御側=とくぼう
 *
 * ■ EV設計（二重加算防止）
 *   - data-base-stat にモード切替前のベース実数値を保存
 *   - stat.value = baseStat + EV  (常に最終値を表示)
 *   - calculate() は stat.value をそのまま使う（EV再加算なし）
 *
 * ■ ランク補正
 *   -6〜+6の13段階。モード切替時もランク数値は維持し参照先のみ切替。
 *   物理モード時: こうげきランクとしてダメージ計算に使用
 *   特殊モード時: とくこうランクとしてダメージ計算に使用
 *
 * ■ ランク倍率表（ポケモンチャンピオンズ準拠）
 *   -6: ×2/8  -5: ×2/7  -4: ×2/6  -3: ×2/5  -2: ×2/4  -1: ×2/3
 *    0: ×2/2 (×1)
 *   +1: ×3/2  +2: ×4/2  +3: ×5/2  +4: ×6/2  +5: ×7/2  +6: ×8/2
 *
 * ■ デフォルトEV
 *   攻撃側: 32 / 防御側: 0
 */

(function () {
'use strict';

// ============================================================
// 実数値計算式（個体値31・EV0・性格補正1.0・Lv50固定）
// ============================================================
const calcHp   = (b) => b + 75;
const calcStat = (b) => b + 20;

// EV値取得ヘルパー（0〜32にクランプ）
function getEv(inputElem) {
    const v = parseInt(inputElem.value) || 0;
    return Math.max(0, Math.min(32, v));
}

// ============================================================
// ランク倍率計算（-6〜+6）
// ============================================================
function getRankMultiplier(rank) {
    const r = Math.max(-6, Math.min(6, rank));
    if (r >= 0) {
        return (2 + r) / 2;
    } else {
        return 2 / (2 - r);
    }
}

// ============================================================
// ローカルデータ
// ============================================================
const POKEMON_DATA = window.POKEMON_DATA || [];
if (POKEMON_DATA.length === 0) {
    console.error('[ポケチャン] pokemon_data.js が読み込まれていません。');
}

const championsRoster = POKEMON_DATA.map(p => ({ name: p.name, id: p.id }));

function getBaseStats(name) {
    const entry = POKEMON_DATA.find(p => p.name === name);
    return entry?.baseStats ?? null;
}

// タイプデータ取得（pokemon_types.js が先に読み込まれている前提）
const POKE_TYPES    = window.POKEMON_TYPES    || {};
const calcTypeMult  = window.calcTypeMultiplier || (() => 1);

function getPokemonTypes(name) {
    return POKE_TYPES[name] || [];
}

// ============================================================
// デフォルト
// ============================================================
const DEFAULTS = { attacker: 'リザードン', defender: 'ガブリアス' };
const DEFAULT_EV = { attacker: 32, defender: 0 };

// ============================================================
// State
// ============================================================
let attackMode  = 'physical'; // 'physical' | 'special'
let attackRank  = 0;

// ============================================================
// DOM Elements
// ============================================================
const el = {
    // 攻撃側
    attackerName:     document.getElementById('attacker-name'),
    attackerStat:     document.getElementById('attacker-stat'),
    attackerStatEv:   document.getElementById('attacker-stat-ev'),
    attackerEvLabel:  document.getElementById('attacker-ev-label'),
    attackerStatLabel:document.getElementById('attacker-stat-label'),
    attackerMegaBtn:  document.getElementById('attacker-mega-btn'),
    attackerArtwork:  document.getElementById('attacker-artwork'),
    attackerFallback: document.getElementById('attacker-fallback'),
    attackerPanel:    document.getElementById('attacker-panel'),

    // 防御側
    defenderName:     document.getElementById('defender-name'),
    defenderHp:       document.getElementById('defender-hp'),
    defenderHpEv:     document.getElementById('defender-hp-ev'),
    defenderStat:     document.getElementById('defender-stat'),
    defenderStatEv:   document.getElementById('defender-stat-ev'),
    defenderEvLabel:  document.getElementById('defender-ev-label'),
    defenderStatLabel:document.getElementById('defender-stat-label'),
    defenderMegaBtn:  document.getElementById('defender-mega-btn'),
    defenderArtwork:  document.getElementById('defender-artwork'),
    defenderFallback: document.getElementById('defender-fallback'),
    defenderPanel:    document.getElementById('defender-panel'),

    // モードボタン（巨大トグル）
    modeToggle: document.getElementById('mode-toggle'),

    // ランク（セレクト型）
    rankSelect:       document.getElementById('rank-select'),
    rankValueDisplay: document.getElementById('rank-value-display'),

    // 共通
    movePower:    document.getElementById('move-power'),
    moveType:     document.getElementById('move-type'),     // 技のタイプ（NEW）
    stabBtn:      document.getElementById('stab-btn'),
    swapBtn:      document.getElementById('swap-btn'),
    resultStatus: document.getElementById('result-status'),
    resultDetail: document.getElementById('result-detail'),
    typeMessage:  document.getElementById('type-message'),  // 相性メッセージ（NEW）
    datalist:     document.getElementById('pokemon-list'),
};

// ============================================================
// ベース実数値ユーティリティ
// ============================================================
function setBase(inputElem, baseValue, ev = 0) {
    inputElem.dataset.baseStat = String(baseValue);
    inputElem.value = baseValue + ev;
}

function getBase(inputElem) {
    if (inputElem.dataset.baseStat !== undefined && inputElem.dataset.baseStat !== '') {
        return parseInt(inputElem.dataset.baseStat) || 0;
    }
    return parseInt(inputElem.value) || 0;
}

function applyEv(statInput, evInput) {
    statInput.value = getBase(statInput) + getEv(evInput);
}

// ============================================================
// ランク表示更新
// ============================================================
function updateRankDisplay() {
    const rank    = attackRank;
    const sign    = rank > 0 ? '+' : '';
    const text    = `${sign}${rank}`;

    el.rankValueDisplay.textContent = text;
    el.rankSelect.value = String(rank);
}

// ============================================================
// モードラベル更新
// ============================================================
function updateModeLabels() {
    const toggleEl = el.modeToggle;

    if (attackMode === 'physical') {
        toggleEl.className   = 'giant-mode-toggle mode-physical';
        toggleEl.textContent = 'こうげき';
        el.attackerEvLabel.textContent   = 'こうげき努力値';
        el.attackerStatLabel.textContent = 'こうげき実数値';
        el.defenderEvLabel.textContent   = 'ぼうぎょ努力値';
        el.defenderStatLabel.textContent = 'ぼうぎょ実数値';
    } else {
        toggleEl.className   = 'giant-mode-toggle mode-special';
        toggleEl.textContent = 'とくこう';
        el.attackerEvLabel.textContent   = 'とくこう努力値';
        el.attackerStatLabel.textContent = 'とくこう実数値';
        el.defenderEvLabel.textContent   = 'とくぼう努力値';
        el.defenderStatLabel.textContent = 'とくぼう実数値';
    }

    updateRankDisplay();
}

// ============================================================
// 現在のモードに合わせてステータスを切り替える（ポケモンは変えない）
// ============================================================
function reapplyModeStats() {
    const atkName = el.attackerName.value.trim();
    const defName = el.defenderName.value.trim();

    // 攻撃側
    const atkBs = getBaseStats(atkName);
    if (atkBs) {
        const base = attackMode === 'physical'
            ? calcStat(atkBs.atk)
            : calcStat(atkBs.spa);
        const ev = getEv(el.attackerStatEv);
        el.attackerStat.dataset.baseStat = String(base);
        el.attackerStat.value = base + ev;
    }

    // 防御側
    const defBs = getBaseStats(defName);
    if (defBs) {
        const base = attackMode === 'physical'
            ? calcStat(defBs.def)
            : calcStat(defBs.spd);
        const ev = getEv(el.defenderStatEv);
        el.defenderStat.dataset.baseStat = String(base);
        el.defenderStat.value = base + ev;
    }

    updateModeLabels();
    calculate();
}

// ============================================================
// 初期化
// ============================================================
function init() {
    buildDatalist();
    buildPowerList();
    setupImageFallbacks();
    setupEventListeners();
    updateModeLabels();

    el.attackerName.value = DEFAULTS.attacker;
    el.defenderName.value = DEFAULTS.defender;
    updatePokemon('attacker');
    updatePokemon('defender');
}

// ============================================================
// 技の威力リスト（5〜300）生成
// ============================================================
function buildPowerList() {
    const frag = document.createDocumentFragment();
    for (let v = 5; v <= 300; v += 5) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        if (v === 90) opt.selected = true;
        frag.appendChild(opt);
    }
    el.movePower.appendChild(frag);
}

// ============================================================
// datalist
// ============================================================
function buildDatalist() {
    const frag = document.createDocumentFragment();
    championsRoster.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        frag.appendChild(opt);
    });
    el.datalist.appendChild(frag);
}

// ============================================================
// 画像フォールバック
// ============================================================
function setupImageFallbacks() {
    ['attacker', 'defender'].forEach(side => {
        const img = el[`${side}Artwork`];
        const fb  = el[`${side}Fallback`];
        img.onload  = () => { img.classList.add('loaded'); fb.style.display = 'none'; };
        img.onerror = () => { img.classList.remove('loaded'); fb.style.display = 'flex'; };
    });
}

// ============================================================
// イベントリスナー
// ============================================================
function setupEventListeners() {

    // ―― 巨大モードトグル（タップで物理↔特殊切り替え）――
    el.modeToggle.addEventListener('click', () => {
        attackMode = (attackMode === 'physical') ? 'special' : 'physical';
        // ランク数値は維持、参照先のみ切り替え
        reapplyModeStats();
    });

    // ―― ランクセレクト（アイテム選択で即時切替）――
    el.rankSelect.addEventListener('change', () => {
        attackRank = parseInt(el.rankSelect.value) || 0;
        updateRankDisplay();
        calculate();
    });

    // ── EV入力 → 実数値欄に直接反映 → 計算 ──
    el.attackerStatEv.addEventListener('input', () => {
        el.attackerStatEv.value = Math.max(0, Math.min(32, parseInt(el.attackerStatEv.value) || 0));
        applyEv(el.attackerStat, el.attackerStatEv);
        calculate();
    });
    el.defenderHpEv.addEventListener('input', () => {
        el.defenderHpEv.value = Math.max(0, Math.min(32, parseInt(el.defenderHpEv.value) || 0));
        applyEv(el.defenderHp, el.defenderHpEv);
        calculate();
    });
    el.defenderStatEv.addEventListener('input', () => {
        el.defenderStatEv.value = Math.max(0, Math.min(32, parseInt(el.defenderStatEv.value) || 0));
        applyEv(el.defenderStat, el.defenderStatEv);
        calculate();
    });

    // blur でもクランプ
    [el.attackerStatEv, el.defenderHpEv, el.defenderStatEv].forEach(ev => {
        ev.addEventListener('blur', () => {
            ev.value = Math.max(0, Math.min(32, parseInt(ev.value) || 0));
        });
    });

    // ── 実数値を手動変更 → ベースを逆算保存 → 計算 ──
    el.attackerStat.addEventListener('input', () => {
        el.attackerStat.dataset.baseStat = String((parseInt(el.attackerStat.value) || 0) - getEv(el.attackerStatEv));
        calculate();
    });
    el.defenderHp.addEventListener('input', () => {
        el.defenderHp.dataset.baseStat = String((parseInt(el.defenderHp.value) || 0) - getEv(el.defenderHpEv));
        calculate();
    });
    el.defenderStat.addEventListener('input', () => {
        el.defenderStat.dataset.baseStat = String((parseInt(el.defenderStat.value) || 0) - getEv(el.defenderStatEv));
        calculate();
    });

    // ─── わざ設定（技のタイプ・威力変更 → 再計算）──
    // selectはchangeイベント、inputはinputイベントの両方を登録して確実に捕捉
    [el.movePower, el.moveType].forEach(inp => {
        inp.addEventListener('input',  calculate);
        inp.addEventListener('change', calculate);
    });

    // ── ポケモン名変更 ──
    el.attackerName.addEventListener('change', () => updatePokemon('attacker'));
    el.defenderName.addEventListener('change', () => updatePokemon('defender'));

    // ── タイプ一致ボタン（手動フラグ — 自動STAB適用の上にさらに×1.5する場合） ──
    // ※ 自動化により基本的に不要だが互換維持のため残す
    el.stabBtn.addEventListener('click', () => {
        el.stabBtn.classList.toggle('active');
        calculate();
    });

    el.swapBtn.addEventListener('click', swapSides);
    el.attackerMegaBtn.addEventListener('click', () => {});
    el.defenderMegaBtn.addEventListener('click', () => {});
}

// ============================================================
// ポケモン更新（完全同期）
// ============================================================
function updatePokemon(side) {
    const name    = el[`${side}Name`].value.trim();
    const pokemon = championsRoster.find(p => p.name === name);

    if (!pokemon) {
        el[`${side}Artwork`].classList.remove('loaded');
        el[`${side}Fallback`].style.display = 'flex';
        calculate();
        return;
    }

    // 画像
    el[`${side}Fallback`].style.display = 'none';
    el[`${side}Artwork`].classList.remove('loaded');
    el[`${side}Artwork`].src =
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;

    // 種族値 → モードに応じたベース実数値を計算
    const bs = getBaseStats(name);
    if (bs) {
        if (side === 'attacker') {
            const base = attackMode === 'physical'
                ? calcStat(bs.atk)
                : calcStat(bs.spa);
            const ev = DEFAULT_EV.attacker; // デフォルトEV=32
            el.attackerStatEv.value = ev;
            setBase(el.attackerStat, base, ev);
        } else {
            const baseHp  = calcHp(bs.hp);
            const baseDef = attackMode === 'physical'
                ? calcStat(bs.def)
                : calcStat(bs.spd);
            const ev = DEFAULT_EV.defender; // デフォルトEV=0
            el.defenderHpEv.value   = ev;
            el.defenderStatEv.value = ev;
            setBase(el.defenderHp,   baseHp,  ev);
            setBase(el.defenderStat, baseDef, ev);
        }
    } else {
        console.warn(`[ポケチャン] ${name} の種族値データがありません`);
    }

    el[`${side}MegaBtn`].disabled = true;
    calculate();
}

// ============================================================
// 攻守交代
// ============================================================
function swapSides() {
    const tmpName = el.attackerName.value;
    el.attackerName.value = el.defenderName.value;
    el.defenderName.value = tmpName;
    updatePokemon('attacker');
    updatePokemon('defender');
}

// ============================================================
// ダメージ計算（Lv50固定）
// タイプ相性は pokemon_types.js の calcTypeMultiplier() を使用
// タイプ一致（STAB）は攻撃側タイプと技タイプを自動比較
// ============================================================
function calculate() {
    const aPoke = championsRoster.find(p => p.name === el.attackerName.value.trim());
    const dPoke = championsRoster.find(p => p.name === el.defenderName.value.trim());

    if (!aPoke || !dPoke) {
        el.resultStatus.textContent = 'スキャン中...';
        el.resultStatus.style.background = '';
        el.resultDetail.textContent      = '0.0% 〜 0.0%';
        el.typeMessage.textContent       = '';
        el.typeMessage.className         = 'type-msg';
        return;
    }

    const aBase  = Math.max(0, parseInt(el.attackerStat.value) || 0);
    const d      = Math.max(1, parseInt(el.defenderStat.value) || 1);
    const hp     = Math.max(1, parseInt(el.defenderHp.value)   || 1);
    const power  = parseInt(el.movePower.value) || 0;

    // ── タイプ自動計算 ──
    const moveType  = el.moveType.value;                        // 技のタイプ
    const atkTypes  = getPokemonTypes(aPoke.name);              // 攻撃側タイプ配列
    const defTypes  = getPokemonTypes(dPoke.name);              // 防御側タイプ配列

    // タイプ相性倍率（0 / 0.25 / 0.5 / 1 / 2 / 4）
    const typeRatio = defTypes.length > 0
        ? calcTypeMult(moveType, defTypes)
        : 1.0;

    // タイプ一致（STAB）: 攻撃側のいずれかのタイプが技タイプと一致
    const stab = atkTypes.includes(moveType) ? 1.5 : 1.0;

    // ランク補正
    const rankMult = getRankMultiplier(attackRank);
    const a = Math.floor(aBase * rankMult);

    const base  = Math.floor(Math.floor(Math.floor(22 * power * a / d) / 50) + 2);
    const final = Math.floor(base * stab * typeRatio);
    const min   = Math.floor(final * 0.85);
    const max   = final;

    showResult(min, max, hp, typeRatio, stab);
}

// ============================================================
// 結果表示（タイプ相性メッセージ付き）
// ============================================================
function showResult(min, max, hp, typeRatio, stab) {
    const minPct = (min / hp * 100).toFixed(1);
    const maxPct = (max / hp * 100).toFixed(1);
    el.resultDetail.textContent = `${minPct}% \u301c ${maxPct}%`;

    // ダメージ判定テキスト
    let text;
    if (max === 0) {
        text = '\u5a01\u529b 0';
    } else if (min >= hp) {
        text = '\u78ba\u5b9a 1 \u767a\uff01\uff01\uff01';
    } else if (max >= hp) {
        const range = max - min + 1;
        const prob  = Math.max(0, Math.min(100,
            Math.floor((range - (hp - min)) / range * 100)));
        text = `\u4e71\u6570 1 \u767a\uff01\uff01\uff01 (${prob}%)`;
    } else {
        const avgHits = Math.ceil(hp / ((min + max) / 2));
        text = `\u78ba\u5b9a ${avgHits} \u767a\uff01\uff01\uff01`;
    }
    el.resultStatus.textContent      = text;
    el.resultStatus.style.background = '';
    el.resultStatus.style.color      = '';

    // 相性メッセージ（5段階）
    const msgEl = el.typeMessage;
    msgEl.className = 'type-msg';
    const stabLabel = (stab > 1) ? '\u30bf\u30a4\u30d7\u4e00\u81f4\uff01 ' : '';

    if (typeRatio === 0) {
        msgEl.textContent = '\u52b9\u679c\u306f\u306a\u3044\u3088\u3046\u3060';
        msgEl.classList.add('msg-immune');
    } else if (typeRatio <= 0.25) {
        msgEl.textContent = stabLabel + '\u52b9\u679c\u306f\u304b\u306a\u308a\u3044\u307e\u3072\u3068\u3064\u306e\u3088\u3046\u3060';
        msgEl.classList.add('msg-bad2');
    } else if (typeRatio < 1) {
        msgEl.textContent = stabLabel + '\u52b9\u679c\u306f\u4eca\u3072\u3068\u3064\u306e\u3088\u3046\u3060';
        msgEl.classList.add('msg-bad');
    } else if (typeRatio >= 4) {
        msgEl.textContent = stabLabel + '\u52b9\u679c\u306f\u3061\u3087\u3046\u3070\u3064\u3050\u3093\u3060\uff01';
        msgEl.classList.add('msg-great');
    } else if (typeRatio >= 2) {
        msgEl.textContent = stabLabel + '\u52b9\u679c\u306f\u3070\u3064\u3050\u3093\u3060\uff01';
        msgEl.classList.add('msg-good');
    } else {
        // x1.0: STAB表示のみ（または空）
        msgEl.textContent = stabLabel ? stabLabel.trim() : '';
    }
}

// ============================================================
// エントリーポイント
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

}()); // IIFE 終わり
