/**
 * ポケチャンシンプルダメ計 | Battle Arena Edition
 * app.js — pokemon_data.json を fetch で非同期取得して動作
 */

(function () {
'use strict';

// POKEMON_DATA は fetch 後に設定される
var POKEMON_DATA = [];

// ============================================================
// ② NFKC 正規化ヘルパー
// ============================================================
function norm(str) {
    return String(str || '').normalize('NFKC').trim();
}

// ============================================================
// ②名前エイリアス（簡称入力 → 正式名に変換）
// ============================================================
var NAME_ALIASES = {
    'ギルガルド':           'ギルガルド(シールド)',
    'ギルガルドシールド':   'ギルガルド(シールド)',
    'ギルガルドブレード':   'ギルガルド(ブレード)',
    'ギルガルドアタック': 'ギルガルド(ブレード)',
};

// ============================================================
// ③ データ検索ヘルパー
// ============================================================
function findPokemon(nameInput) {
    var key = norm(nameInput);
    if (!key) return null;
    // エイリアス経由の検索
    var aliasKey = NAME_ALIASES[key];
    if (!aliasKey) {
        // NFKC正規化後のエイリアスコチュック（半角や全角の表記摇れ対応）
        for (var alias in NAME_ALIASES) {
            if (norm(alias) === key) { aliasKey = NAME_ALIASES[alias]; break; }
        }
    }
    var searchKey = aliasKey ? norm(aliasKey) : key;
    // まず完全一致を探す
    for (var i = 0; i < POKEMON_DATA.length; i++) {
        if (norm(POKEMON_DATA[i].name) === searchKey) return POKEMON_DATA[i];
    }
    return null;
}

function getBaseStats(nameInput) {
    var p = findPokemon(nameInput);
    return p ? p.baseStats : null;
}

// 文字列 "['ほのお', 'ひこう']" を配列 ['ほのお','ひこう'] に正規化
function normalizeTypes(types) {
    if (Array.isArray(types)) return types;
    // 文字列の場合：[ ] ' " をすべて除去して split
    return String(types)
        .replace(/[\[\]'\"]/g, '')
        .split(',')
        .map(function(t) { return t.trim(); })
        .filter(function(t) { return t.length > 0; });
}

function getPokemonTypes(nameInput) {
    var p = findPokemon(nameInput);
    return p ? normalizeTypes(p.types) : [];
}

// ============================================================
// ④ 実数値計算式（Lv50・個体値31・性格補正1.0固定）
// ============================================================
var calcHp   = function(b) { return b + 75; };
var calcStat = function(b) { return b + 20; };

// ============================================================
// ⑤ ランク倍率（-6〜+6）
// ============================================================
function getRankMultiplier(rank) {
    var r = Math.max(-6, Math.min(6, rank));
    return r >= 0 ? (2 + r) / 2 : 2 / (2 - r);
}

// ============================================================
// ⑥ デフォルト値
// ============================================================
var DEFAULTS   = { attacker: 'リザードン', defender: 'ガブリアス' };
var DEFAULT_EV = { attacker: 32, defender: 0 };

// ============================================================
// ⑦ State
// ============================================================
var attackMode = 'physical';
var attackRank = 0;

// メガシンカ状態: { attacker: [通常名, メガ名, メガY名...], index: 0 }
var megaState = {
    attacker: { baseName: '', forms: [], index: 0 },
    defender: { baseName: '', forms: [], index: 0 },
};

// フォルムチェンジ専用のループ定義（メガシンカとは別系統）
var FORM_CYCLES = {
    'ギルガルド(シールド)': ['ギルガルド(シールド)', 'ギルガルド(ブレード)'],
    'ギルガルド(ブレード)': ['ギルガルド(シールド)', 'ギルガルド(ブレード)'],
};

// ポケモン名からメガシンカ・フォルムチェンジ一覧を収集
function getMegaForms(baseName) {
    // フォルムチェンジ専用定義を優先チェック
    if (FORM_CYCLES[baseName]) return FORM_CYCLES[baseName].slice();

    var key = norm(baseName);
    var forms = [baseName]; 
    
    // 「メガ + 名前」「メガ + 名前 + X/Y」の順で検索
    var variants = [
        'メガ' + baseName,
        'メガ' + baseName + 'X',
        'メガ' + baseName + 'Y',
        baseName + '(メガ)',
    ];
    variants.forEach(function(v) {
        var p = findPokemon(v);
        if (p && forms.indexOf(p.name) === -1) forms.push(p.name);
    });

    // 特殊：リザードンのように複数ある場合や、CSVの「メガ○○」形式も補完
    POKEMON_DATA.forEach(function(p) {
        var n = norm(p.name);
        if (p.isMega && n.indexOf(key) !== -1 && forms.indexOf(p.name) === -1) {
            forms.push(p.name);
        }
    });

    return forms;
}

// ============================================================
// ⑧ DOM 参照
// ============================================================
var el = {
    attackerName:      document.getElementById('attacker-name'),
    attackerStat:      document.getElementById('attacker-stat'),
    attackerStatEv:    document.getElementById('attacker-stat-ev'),
    attackerEvLabel:   document.getElementById('attacker-ev-label'),
    attackerStatLabel: document.getElementById('attacker-stat-label'),
    attackerMegaBtn:   document.getElementById('attacker-mega-btn'),
    attackerArtwork:   document.getElementById('attacker-artwork'),
    attackerFallback:  document.getElementById('attacker-fallback'),

    defenderName:      document.getElementById('defender-name'),
    defenderHp:        document.getElementById('defender-hp'),
    defenderHpEv:      document.getElementById('defender-hp-ev'),
    defenderStat:      document.getElementById('defender-stat'),
    defenderStatEv:    document.getElementById('defender-stat-ev'),
    defenderEvLabel:   document.getElementById('defender-ev-label'),
    defenderStatLabel: document.getElementById('defender-stat-label'),
    defenderMegaBtn:   document.getElementById('defender-mega-btn'),
    defenderArtwork:   document.getElementById('defender-artwork'),
    defenderFallback:  document.getElementById('defender-fallback'),

    modeToggle:        document.getElementById('mode-toggle'),
    rankSelect:        document.getElementById('rank-select'),
    rankValueDisplay:  document.getElementById('rank-value-display'),
    movePower:         document.getElementById('move-power'),
    moveType:          document.getElementById('move-type'),
    swapBtn:           document.getElementById('swap-btn'),
    partySelect:       document.getElementById('party-select'),
    partyAtkBtn:       document.getElementById('party-atk-btn'),
    partyDefBtn:       document.getElementById('party-def-btn'),
    resultStatus:      document.getElementById('result-status'),
    resultDetail:      document.getElementById('result-detail'),
    typeMessage:       document.getElementById('type-message'),
    datalist:          document.getElementById('pokemon-list'),
    attackerSuggest:   document.getElementById('attacker-suggest'),
    defenderSuggest:   document.getElementById('defender-suggest'),
    attackerArtbox:    document.getElementById('attacker-artbox'),
    defenderArtbox:    document.getElementById('defender-artbox'),
    attackerMegaInd:   document.getElementById('attacker-mega-indicator'),
    defenderMegaInd:   document.getElementById('defender-mega-indicator'),
};

// ============================================================
// ⑨ ベース実数値ユーティリティ
// ============================================================
function setBase(inputElem, baseValue, ev) {
    ev = ev || 0;
    inputElem.dataset.baseStat = String(baseValue);
    inputElem.value = baseValue + ev;
}

function getBase(inputElem) {
    var b = inputElem.dataset.baseStat;
    if (b !== undefined && b !== '') return parseInt(b) || 0;
    return parseInt(inputElem.value) || 0;
}

function getEv(inputElem) {
    return Math.max(0, Math.min(32, parseInt(inputElem.value) || 0));
}

function applyEv(statInput, evInput) {
    statInput.value = getBase(statInput) + getEv(evInput);
}

// ============================================================
// ⑩ ランク表示更新
// ============================================================
function updateRankDisplay() {
    var sign = attackRank > 0 ? '+' : '';
    el.rankValueDisplay.textContent = sign + attackRank;
    el.rankSelect.value = String(attackRank);
}

// ============================================================
// ⑪ モードラベル更新
// ============================================================
function updateModeLabels() {
    if (attackMode === 'physical') {
        el.modeToggle.className   = 'giant-mode-toggle mode-physical';
        el.modeToggle.textContent = 'こうげき';
        el.attackerEvLabel.textContent   = 'こうげき努力値';
        el.attackerStatLabel.textContent = 'こうげき実数値';
        el.defenderEvLabel.textContent   = 'ぼうぎょ努力値';
        el.defenderStatLabel.textContent = 'ぼうぎょ実数値';
    } else {
        el.modeToggle.className   = 'giant-mode-toggle mode-special';
        el.modeToggle.textContent = 'とくこう';
        el.attackerEvLabel.textContent   = 'とくこう努力値';
        el.attackerStatLabel.textContent = 'とくこう実数値';
        el.defenderEvLabel.textContent   = 'とくぼう努力値';
        el.defenderStatLabel.textContent = 'とくぼう実数値';
    }
    updateRankDisplay();
}

// ============================================================
// ⑫ モード切替時に実数値を再適用
// ============================================================
function reapplyModeStats() {
    var atkBs = getBaseStats(el.attackerName.value);
    if (atkBs) {
        var base = attackMode === 'physical' ? calcStat(atkBs.atk) : calcStat(atkBs.spa);
        var ev   = getEv(el.attackerStatEv);
        setBase(el.attackerStat, base, ev);
    }

    var defBs = getBaseStats(el.defenderName.value);
    if (defBs) {
        var base2 = attackMode === 'physical' ? calcStat(defBs.def) : calcStat(defBs.spd);
        var ev2   = getEv(el.defenderStatEv);
        setBase(el.defenderStat, base2, ev2);
    }

    updateModeLabels();
    calculate();
}

// ============================================================
// ⑬ datalist / 威力リスト 構築
// ============================================================
function buildDatalist() {
    // カスタムサジェストを使うため datalist は不要
}

function buildPowerList() {
    var frag = document.createDocumentFragment();
    for (var v = 5; v <= 300; v += 5) {
        var opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        if (v === 90) opt.selected = true;
        frag.appendChild(opt);
    }
    el.movePower.appendChild(frag);
}

// ============================================================
// ⑬-B カスタムサジェスト
// ============================================================
var suggestState = { attacker: -1, defender: -1 };

function highlightMatch(text, query) {
    var n = norm(query);
    var t = norm(text);
    var idx = t.indexOf(n);
    if (!n || idx === -1) return document.createTextNode(text);
    var span = document.createElement('span');
    span.appendChild(document.createTextNode(text.slice(0, idx)));
    var mark = document.createElement('span');
    mark.className = 'suggest-match';
    mark.textContent = text.slice(idx, idx + query.length);
    span.appendChild(mark);
    span.appendChild(document.createTextNode(text.slice(idx + query.length)));
    return span;
}

function showSuggest(side, query) {
    var box = el[side + 'Suggest'];
    var q   = norm(query);
    if (!q) { hideSuggest(side); return; }

    // 前方一致 → 部分一致の順で最大15件
    var prefix = [], partial = [];
    for (var i = 0; i < POKEMON_DATA.length; i++) {
        var n = norm(POKEMON_DATA[i].name);
        if (n === q) continue; // 完全一致は不要
        if (n.startsWith(q))     { prefix.push(POKEMON_DATA[i]); }
        else if (n.includes(q))  { partial.push(POKEMON_DATA[i]); }
        if (prefix.length + partial.length >= 15) break;
    }
    var candidates = prefix.concat(partial).slice(0, 12);

    if (candidates.length === 0) { hideSuggest(side); return; }

    box.innerHTML = '';
    suggestState[side] = -1;

    candidates.forEach(function(p, idx) {
        var item = document.createElement('div');
        item.className = 'suggest-item';
        item.appendChild(highlightMatch(p.name, query));

        item.addEventListener('mousedown', function(e) {
            e.preventDefault(); // blur を防ぐ
        });
        item.addEventListener('click', function() {
            el[side + 'Name'].value = p.name;
            hideSuggest(side);
            updatePokemon(side);
        });
        // タッチ対応
        item.addEventListener('touchend', function(e) {
            e.preventDefault();
            el[side + 'Name'].value = p.name;
            hideSuggest(side);
            updatePokemon(side);
        });
        box.appendChild(item);
    });

    box.hidden = false;
}

function hideSuggest(side) {
    el[side + 'Suggest'].hidden = true;
    el[side + 'Suggest'].innerHTML = '';
    suggestState[side] = -1;
}

function navigateSuggest(side, dir) {
    var box   = el[side + 'Suggest'];
    var items = box.querySelectorAll('.suggest-item');
    if (!items.length) return;
    var cur = suggestState[side];
    items[cur] && items[cur].classList.remove('active');
    cur = (cur + dir + items.length) % items.length;
    suggestState[side] = cur;
    items[cur].classList.add('active');
    items[cur].scrollIntoView({ block: 'nearest' });
}

function selectActiveSuggest(side) {
    var box  = el[side + 'Suggest'];
    var cur  = suggestState[side];
    var item = box.querySelectorAll('.suggest-item')[cur];
    if (!item) return false;
    item.click();
    return true;
}

// ============================================================
// ⑭ 画像セット（PokeAPI 動的同期）
// ============================================================
var speciesCache = {};
var artworkRequests = { attacker: 0, defender: 0 };

async function setArtwork(side, pokemon) {
    var img = el[side + 'Artwork'];
    var fb  = el[side + 'Fallback'];
    var rid = ++artworkRequests[side];
    
    if (!pokemon) {
        img.classList.remove('loaded');
        fb.style.display = 'flex';
        return;
    }

    fb.style.display = 'none';
    img.classList.remove('loaded');

    // 画像セット用プロミス（最新リクエストのみ有効）
    const trySet = (url) => {
        return new Promise((resolve) => {
            if (rid !== artworkRequests[side]) return resolve(false);
            img.onload = () => {
                if (rid === artworkRequests[side]) {
                    img.classList.add('loaded');
                    fb.style.display = 'none';
                    resolve(true);
                } else resolve(false);
            };
            img.onerror = () => resolve(false);
            img.src = url;
        });
    };

    try {
        // 1. Local Check: images/[名前].png
        try {
            const localUrl = 'images/' + pokemon.name + '.png';
            const localRes = await fetch(localUrl, { method: 'HEAD' });
            if (localRes.ok && await trySet(localUrl)) return;
        } catch(e) {}

        // 2. 英語名の取得（キャッシュ利用）
        var dexId = pokemon.dexId;
        var baseName = speciesCache[dexId];
        if (!baseName) {
            const sRes = await fetch('https://pokeapi.co/api/v2/pokemon-species/' + dexId);
            if (sRes.ok) {
                const sData = await sRes.json();
                baseName = sData.name;
                speciesCache[dexId] = baseName;
            }
        }

        if (rid !== artworkRequests[side]) return;

        // 3. スラッグの構築
        var jName = pokemon.name;

        // ── 名前 → 確定スラッグ マッピング（PokeAPI命名ルール差異を吸収）──
        var SLUG_OVERRIDES = {
            // ギルガルド
            'ギルガルド':          'aegislash-shield',
            'ギルガルド(シールド)': 'aegislash-shield',
            'ギルガルド(ブレード)': 'aegislash-blade',
            // パンプジン
            'パンプジン(小さい)':  'gourgeist-small',
            'パンプジン(普通)':    'gourgeist-average',
            'パンプジン(大きい)':  'gourgeist-large',
            'パンプジン(特大)':    'gourgeist-super',
            // ミミッキュ
            'ミミッキュ':          'mimikyu-disguised',
            // モルペコ
            'モルペコ':            'morpeko-full-belly',
            // ケンタロス(パルデア)
            'ケンタロス(パルデア単)': 'tauros-paldea-combat-breed',
            'ケンタロス(パルデア炎)': 'tauros-paldea-blaze-breed',
            'ケンタロス(パルデア水)': 'tauros-paldea-aqua-breed',
            // イルカマン
            'イルカマン(ナイーブ)': 'palafin-zero',
            'イルカマン(マイティ)': 'palafin-hero',
            // カエンジシ
            'カエンジシ':          'pyroar-male',
            // フラエッテ
            'フラエッテ(えいえんのはな)': 'floette-eternal',
        };

        var slug = (SLUG_OVERRIDES[jName] !== undefined)
            ? SLUG_OVERRIDES[jName]
            : (function() {
                var s = baseName || '';
                if (pokemon.isMega) {
                    s += '-mega';
                    if (jName.indexOf('X') !== -1) s += '-x';
                    else if (jName.indexOf('Y') !== -1) s += '-y';
                } else if (jName.indexOf('アローラ') !== -1) s += '-alola';
                else if (jName.indexOf('ガラル') !== -1) s += '-galar';
                else if (jName.indexOf('パルデア') !== -1) s += '-paldea';
                else if (jName.indexOf('ヒスイ') !== -1) s += '-hisui';
                else if (jName.indexOf('まひる') !== -1) s += '-midday';
                else if (jName.indexOf('まよなか') !== -1) s += '-midnight';
                else if (jName.indexOf('たそがれ') !== -1) s += '-dusk';
                else if (jName.indexOf('オス') !== -1) s += '-male';
                else if (jName.indexOf('メス') !== -1 && !jName.indexOf('メスのすがた')) s += '-female';
                return s;
              })();

        // 4. Try API Slug: Official -> Normal
        if (slug) {
            const pRes = await fetch('https://pokeapi.co/api/v2/pokemon/' + slug);
            if (pRes.ok) {
                const pData = await pRes.json();
                const art = pData.sprites.other['official-artwork'].front_default;
                const nrm = pData.sprites.front_default;
                if (art && await trySet(art)) return;
                if (nrm && await trySet(nrm)) return;
            }
        }

        // 5. Try API Base: Official -> Normal
        if (baseName && baseName !== slug) {
            const bRes = await fetch('https://pokeapi.co/api/v2/pokemon/' + baseName);
            if (bRes.ok) {
                const bData = await bRes.json();
                const bart = bData.sprites.other['official-artwork'].front_default;
                const bnrm = bData.sprites.front_default;
                if (bart && await trySet(bart)) return;
                if (bnrm && await trySet(bnrm)) return;
            }
        }

        // 全て失敗
        if (rid === artworkRequests[side]) fb.style.display = 'flex';

    } catch (e) {
        console.warn('[ポケチャン] 画像取得エラー:', e);
        if (rid === artworkRequests[side]) fb.style.display = 'flex';
    }
}

function clearArtwork(side) {
    el[side + 'Artwork'].classList.remove('loaded');
    el[side + 'Fallback'].style.display = 'flex';
}

// ============================================================
// ⑮ ポケモン更新（名前入力 → 実数値即反映）
// ============================================================
function updatePokemon(side, nameOverride) {
    var nameInput = nameOverride !== undefined ? nameOverride : el[side + 'Name'].value;
    var pokemon   = findPokemon(nameInput);

    if (!pokemon) {
        clearArtwork(side);
        calculate();
        return;
    }

    // 名前欄を更新（nameOverride経由の場合）
    if (nameOverride !== undefined) {
        el[side + 'Name'].value = nameOverride;
    }

    var bs = pokemon.baseStats;
    if (side === 'attacker') {
        var base = attackMode === 'physical' ? calcStat(bs.atk) : calcStat(bs.spa);
        var ev   = DEFAULT_EV.attacker;
        el.attackerStatEv.value = ev;
        setBase(el.attackerStat, base, ev);
    } else {
        var baseHp  = calcHp(bs.hp);
        var baseDef = attackMode === 'physical' ? calcStat(bs.def) : calcStat(bs.spd);
        var ev2     = DEFAULT_EV.defender;
        el.defenderHpEv.value   = ev2;
        el.defenderStatEv.value = ev2;
        setBase(el.defenderHp,   baseHp,  ev2);
        setBase(el.defenderStat, baseDef, ev2);
    }

    // メガ状態リセット（手入力・パーティ選択時）
    if (nameOverride !== undefined || arguments.length === 1) {
        var forms = getMegaForms(pokemon.name);
        megaState[side].baseName = pokemon.name;
        megaState[side].forms    = forms;
        megaState[side].index    = 0;
        updateMegaIndicator(side);
    }

    calculate();
    setArtwork(side, pokemon);
}

// ============================================================
// ⑯ メガシンカインジケーター
// ============================================================
function updateMegaIndicator(side) {
    var st  = megaState[side];
    var ind = el[side + 'MegaInd'];
    var box = el[side + 'Artbox'];
    if (st.forms.length <= 1) {
        ind.textContent = '';
        ind.className   = 'mega-indicator';
        box.classList.remove('has-mega');
    } else {
        // フォルムチェンジ系か メガシンカ系かで表示を分ける
        var isFormChange = !!FORM_CYCLES[st.forms[0]];
        var curName = st.forms[st.index];
        if (isFormChange) {
            // ギルガルド等: 盾/剣 アイコン
            var isShield = curName.indexOf('シールド') !== -1;
            ind.textContent = isShield ? '🛡 タップで⚔' : '⚔ タップで🛡';
            ind.className   = 'mega-indicator active form-change';
        } else {
            var isMega = st.index > 0;
            ind.textContent = isMega ? ('▲ ' + curName) : '▲ MEGA 可';
            ind.className   = 'mega-indicator' + (isMega ? ' active' : '');
        }
        box.classList.toggle('has-mega', true);
    }
}

// ============================================================
// ⑰ 画像クリック → メガシンカトグル
// ============================================================
function cycleForm(side) {
    var st = megaState[side];
    if (st.forms.length <= 1) return; // メガなし
    st.index = (st.index + 1) % st.forms.length;
    var newName = st.forms[st.index];
    var pokemon = findPokemon(newName);
    if (!pokemon) return;

    el[side + 'Name'].value = newName;
    var bs = pokemon.baseStats;
    if (side === 'attacker') {
        var base = attackMode === 'physical' ? calcStat(bs.atk) : calcStat(bs.spa);
        var ev   = getEv(el.attackerStatEv);
        setBase(el.attackerStat, base, ev);
    } else {
        var baseHp  = calcHp(bs.hp);
        var baseDef = attackMode === 'physical' ? calcStat(bs.def) : calcStat(bs.spd);
        var ev2     = getEv(el.defenderStatEv);
        setBase(el.defenderHp,   baseHp,  ev2);
        setBase(el.defenderStat, baseDef, ev2);
    }
    updateMegaIndicator(side);
    calculate();
    setArtwork(side, pokemon);
}

// ============================================================
// ⑱ 攻守交代
// ============================================================
function swapSides() {
    var tmp = el.attackerName.value;
    el.attackerName.value = el.defenderName.value;
    el.defenderName.value = tmp;
    updatePokemon('attacker');
    updatePokemon('defender');
}

// ============================================================
// ⑰ ダメージ計算
// ============================================================
function calculate() {
    var aPoke = findPokemon(el.attackerName.value);
    var dPoke = findPokemon(el.defenderName.value);

    if (!aPoke || !dPoke) {
        el.resultStatus.textContent      = 'スキャン中...';
        el.resultStatus.style.background = '';
        el.resultDetail.textContent      = '0.0% 〜 0.0%';
        el.typeMessage.textContent       = '';
        el.typeMessage.className         = 'type-msg';
        return;
    }

    var aBase = Math.max(0, parseInt(el.attackerStat.value) || 0);
    var d     = Math.max(1, parseInt(el.defenderStat.value) || 1);
    var hp    = Math.max(1, parseInt(el.defenderHp.value)   || 1);
    var power = parseInt(el.movePower.value) || 0;

    var moveType = el.moveType.value;
    var atkTypes = getPokemonTypes(aPoke.name);
    var defTypes = getPokemonTypes(dPoke.name);

    var typeRatio = (typeof window.calcTypeMultiplier === 'function' && defTypes.length > 0)
        ? window.calcTypeMultiplier(moveType, defTypes)
        : 1.0;

    var stab = (atkTypes.indexOf(moveType) !== -1) ? 1.5 : 1.0;

    var rankMult = getRankMultiplier(attackRank);
    var a = Math.floor(aBase * rankMult);

    var base2  = Math.floor(Math.floor(Math.floor(22 * power * a / d) / 50) + 2);
    var final2 = Math.floor(base2 * stab * typeRatio);
    var min    = Math.floor(final2 * 0.85);
    var max    = final2;

    showResult(min, max, hp, typeRatio, stab);
}

// ============================================================
// ⑱ 結果表示
// ============================================================
function showResult(min, max, hp, typeRatio, stab) {
    var minPct = (min / hp * 100).toFixed(1);
    var maxPct = (max / hp * 100).toFixed(1);
    el.resultDetail.textContent = minPct + '% 〜 ' + maxPct + '%';

    var text;
    if (max === 0) {
        text = '威力 0';
    } else if (min >= hp) {
        text = '確定 1 発！！！';
    } else if (max >= hp) {
        var range = max - min + 1;
        var prob  = Math.max(0, Math.min(100, Math.floor((range - (hp - min)) / range * 100)));
        text = '乱数 1 発！！！ (' + prob + '%)';
    } else {
        var avgHits = Math.ceil(hp / ((min + max) / 2));
        text = '確定 ' + avgHits + ' 発！！！';
    }
    el.resultStatus.textContent      = text;
    el.resultStatus.style.background = '';
    el.resultStatus.style.color      = '';

    var msgEl     = el.typeMessage;
    msgEl.className = 'type-msg';
    var stabLabel = stab > 1 ? 'タイプ一致！ ' : '';

    if (typeRatio === 0) {
        msgEl.textContent = '効果はないようだ';
        msgEl.classList.add('msg-immune');
    } else if (typeRatio <= 0.25) {
        msgEl.textContent = stabLabel + '効果はかなりいまひとつのようだ';
        msgEl.classList.add('msg-bad2');
    } else if (typeRatio < 1) {
        msgEl.textContent = stabLabel + '効果はいまひとつのようだ';
        msgEl.classList.add('msg-bad');
    } else if (typeRatio >= 4) {
        msgEl.textContent = stabLabel + '効果はちょうばつぐんだ！';
        msgEl.classList.add('msg-great');
    } else if (typeRatio >= 2) {
        msgEl.textContent = stabLabel + '効果はばつぐんだ！';
        msgEl.classList.add('msg-good');
    } else {
        msgEl.textContent = stabLabel ? stabLabel.trim() : '';
    }
}

// ============================================================
// ⑲ イベントリスナー
// ============================================================
function setupEventListeners() {

    el.modeToggle.addEventListener('click', function() {
        attackMode = (attackMode === 'physical') ? 'special' : 'physical';
        reapplyModeStats();
    });

    el.rankSelect.addEventListener('change', function() {
        attackRank = parseInt(el.rankSelect.value) || 0;
        updateRankDisplay();
        calculate();
    });

    el.attackerStatEv.addEventListener('input', function() {
        el.attackerStatEv.value = Math.max(0, Math.min(32, parseInt(el.attackerStatEv.value) || 0));
        applyEv(el.attackerStat, el.attackerStatEv);
        calculate();
    });
    el.defenderHpEv.addEventListener('input', function() {
        el.defenderHpEv.value = Math.max(0, Math.min(32, parseInt(el.defenderHpEv.value) || 0));
        applyEv(el.defenderHp, el.defenderHpEv);
        calculate();
    });
    el.defenderStatEv.addEventListener('input', function() {
        el.defenderStatEv.value = Math.max(0, Math.min(32, parseInt(el.defenderStatEv.value) || 0));
        applyEv(el.defenderStat, el.defenderStatEv);
        calculate();
    });

    [el.attackerStatEv, el.defenderHpEv, el.defenderStatEv].forEach(function(ev) {
        ev.addEventListener('blur', function() {
            ev.value = Math.max(0, Math.min(32, parseInt(ev.value) || 0));
        });
    });

    el.attackerStat.addEventListener('input', function() {
        el.attackerStat.dataset.baseStat = String((parseInt(el.attackerStat.value) || 0) - getEv(el.attackerStatEv));
        calculate();
    });
    el.defenderHp.addEventListener('input', function() {
        el.defenderHp.dataset.baseStat = String((parseInt(el.defenderHp.value) || 0) - getEv(el.defenderHpEv));
        calculate();
    });
    el.defenderStat.addEventListener('input', function() {
        el.defenderStat.dataset.baseStat = String((parseInt(el.defenderStat.value) || 0) - getEv(el.defenderStatEv));
        calculate();
    });

    el.movePower.addEventListener('input',  calculate);
    el.movePower.addEventListener('change', calculate);
    el.moveType.addEventListener('input',   calculate);
    el.moveType.addEventListener('change',  calculate);

    // changeイベント：datalistから選択した瞬間に発火
    el.attackerName.addEventListener('change', function() {
        hideSuggest('attacker');
        updatePokemon('attacker');
    });
    el.defenderName.addEventListener('change', function() {
        hideSuggest('defender');
        updatePokemon('defender');
    });

    // inputイベント：1文字入力ごとにサジェスト表示
    el.attackerName.addEventListener('input', function() {
        showSuggest('attacker', el.attackerName.value);
        if (findPokemon(el.attackerName.value)) {
            hideSuggest('attacker');
            updatePokemon('attacker');
        }
    });
    el.defenderName.addEventListener('input', function() {
        showSuggest('defender', el.defenderName.value);
        if (findPokemon(el.defenderName.value)) {
            hideSuggest('defender');
            updatePokemon('defender');
        }
    });

    // キーボード操作（↑↓Enter / Escape）
    ['attacker', 'defender'].forEach(function(side) {
        el[side + 'Name'].addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown')  { e.preventDefault(); navigateSuggest(side, 1); }
            else if (e.key === 'ArrowUp')   { e.preventDefault(); navigateSuggest(side, -1); }
            else if (e.key === 'Enter')     { if (selectActiveSuggest(side)) e.preventDefault(); }
            else if (e.key === 'Escape')    { hideSuggest(side); }
        });
        // フォーカスを外したらドロップダウンを閉じる
        el[side + 'Name'].addEventListener('blur', function() {
            setTimeout(function() { hideSuggest(side); }, 150);
        });
    });

    el.stabBtn && el.stabBtn.addEventListener && el.stabBtn.addEventListener('click', function() {
        el.stabBtn.classList.toggle('active');
        calculate();
    });
    el.swapBtn.addEventListener('click', swapSides);

    // 画像クリック → メガシンカループ
    el.attackerArtbox.addEventListener('click', function() { cycleForm('attacker'); });
    el.defenderArtbox.addEventListener('click', function() { cycleForm('defender'); });
    // マイパーティの攻/防ボタンは℡のパーティモジュールで登録（二重登録防止）
}

// ============================================================
// ⑳ 初期化（JSON fetch → データロード → UI 起動）
// ============================================================
function init(data) {
    POKEMON_DATA = data;
    console.info('[ポケチャン] JSONデータ起動 — ' + POKEMON_DATA.length + '匹');

    // ── 起動時データ検証ログ ──
    var checks = { 'クエスパトラ': 956, 'ヒラヒナ': 955, 'キラフロル': 970 };
    Object.keys(checks).forEach(function(name) {
        var p = findPokemon(name);
        var expected = checks[name];
        if (!p) {
            console.warn('[ポケチャン] ⚠ ' + name + ' がデータに見つかりません');
        } else if (p.dexId !== expected) {
            console.error('[ポケチャン] ❌ ' + name + ' dexId=' + p.dexId + ' (期待値=' + expected + ')');
        } else {
            console.info('[ポケチャン] ✅ ' + name + ' dexId=' + p.dexId + ' OK');
        }
    });

    buildDatalist();
    buildPowerList();
    setupEventListeners();
    updateModeLabels();

    el.attackerName.value = DEFAULTS.attacker;
    el.defenderName.value = DEFAULTS.defender;
    updatePokemon('attacker');
    updatePokemon('defender');
}

// ============================================================
// fetch エントリポイント
// ============================================================
function loadAndStart() {
    fetch('pokemon_data.json')
        .then(function(res) {
            if (!res.ok) throw new Error('fetch失敗: ' + res.status);
            return res.json();
        })
        .then(function(data) {
            init(data);
        })
        .catch(function(err) {
            console.error('[ポケチャン] pokemon_data.json の読み込みに失敗しました:', err);
            el.resultStatus.textContent = 'データ読み込みエラー';
        });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndStart);
} else {
    loadAndStart();
}

// ============================================================
// ㉑ マイパーティ機能
// ============================================================

// ── 定数 ──
var PARTY_KEY  = 'my_party';
var PARTY_SIZE = 6;
var EV_KEYS    = ['H','A','B','C','D','S'];

var NATURE_TABLE = {
    'ひかえめ':   {up:'C', down:'A'},
    'おくびょう': {up:'S', down:'A'},
    'おだやか':   {up:'D', down:'A'},
    'なまいき':   {up:'D', down:'S'},
    'しんちょう': {up:'D', down:'C'},
    'ずぶとい':   {up:'B', down:'A'},
    'わんぱく':   {up:'B', down:'C'},
    'のんき':     {up:'B', down:'S'},
    'いじっぱり': {up:'A', down:'C'},
    'ゆうかん':   {up:'A', down:'S'},
    'うっかりや': {up:'A', down:'D'},
    'ようき':     {up:'S', down:'C'},
    'むじゃき':   {up:'S', down:'D'},
    'さみしがり': {up:'A', down:'B'},
    'やんちゃ':   {up:'A', down:'D'},
    'おっとり':   {up:'C', down:'B'},
    'うかつ':     {up:'C', down:'D'},
    'れいせい':   {up:'C', down:'S'},
};
var NATURE_NAMES = [
    'なし（補正なし）',
    'ひかえめ','おくびょう','おだやか','なまいき','しんちょう',
    'ずぶとい','わんぱく','のんき',
    'いじっぱり','ゆうかん',
    'ようき','むじゃき',
    'さみしがり','やんちゃ',
    'おっとり','うかつ','れいせい',
    'うっかりや',
];

function getNatureMult(nature, statKey) {
    var n = NATURE_TABLE[nature];
    if (!n) return 1.0;
    if (n.up === statKey) return 1.1;
    if (n.down === statKey) return 0.9;
    return 1.0;
}

function calcRealStat(base, ev, nature, statKey) {
    ev = Math.max(0, Math.min(32, ev || 0));
    if (statKey === 'H') {
        return Math.floor((base * 2 + 31 + ev) * 50 / 100) + 60;
    }
    var raw = Math.floor((base * 2 + 31 + ev) * 50 / 100) + 5;
    return Math.floor(raw * getNatureMult(nature, statKey));
}

function defaultParty() {
    return ['ガブリアス','ブリジュラス','バンギラス','カバルドン','ギルガルド','スターミー'].map(function(name) {
        return { name: name, evs: {H:0,A:0,B:0,C:0,D:0,S:0}, nature: 'なし（補正なし）' };
    });
}

function loadParty() {
    try {
        var raw = localStorage.getItem(PARTY_KEY);
        if (!raw) return defaultParty();
        var arr = JSON.parse(raw);
        while (arr.length < PARTY_SIZE) arr.push({ name: '', evs: {H:0,A:0,B:0,C:0,D:0,S:0}, nature: 'なし（補正なし）' });
        return arr.slice(0, PARTY_SIZE).map(function(p) {
            return {
                name:   String(p.name || ''),
                evs:    { H: p.evs.H||0, A: p.evs.A||0, B: p.evs.B||0, C: p.evs.C||0, D: p.evs.D||0, S: p.evs.S||0 },
                nature: String(p.nature || 'なし（補正なし）'),
            };
        });
    } catch(e) { return defaultParty(); }
}

function saveParty(arr) {
    localStorage.setItem(PARTY_KEY, JSON.stringify(arr));
}

function syncPartySelect(arr) {
    var sel = document.getElementById('party-select');
    sel.innerHTML = '<option value="">── 選択 ──</option>';
    arr.forEach(function(p, i) {
        if (!p.name) return;
        var opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = (i + 1) + '. ' + p.name;
        sel.appendChild(opt);
    });
}

var partyModal    = document.getElementById('party-modal');
var partySlots    = document.getElementById('party-slots');
var modalSaveBtn  = document.getElementById('modal-save-btn');
var modalCloseBtn = document.getElementById('modal-close-btn');
var partyEditBtn  = document.getElementById('party-edit-btn');

function openPartyModal() {
    var party = loadParty();
    partySlots.innerHTML = '';
    party.forEach(function(p, idx) {
        var card = document.createElement('div');
        card.className = 'slot-card';
        card.dataset.idx = idx;

        var numEl = document.createElement('div');
        numEl.className = 'slot-num';
        numEl.textContent = 'SLOT ' + (idx + 1);
        card.appendChild(numEl);

        var nameRow = document.createElement('div');
        nameRow.className = 'slot-name-row';

        var nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.className = 'slot-name-input';
        nameInp.placeholder = 'ポケモン名';
        nameInp.value = p.name;
        nameInp.autocomplete = 'off';
        nameInp.setAttribute('list', 'pokemon-list');
        nameRow.appendChild(nameInp);

        var natureSel = document.createElement('select');
        natureSel.className = 'slot-nature-select';
        NATURE_NAMES.forEach(function(n) {
            var opt = document.createElement('option');
            opt.value = n;
            opt.textContent = n;
            if (n === p.nature) opt.selected = true;
            natureSel.appendChild(opt);
        });
        nameRow.appendChild(natureSel);
        card.appendChild(nameRow);

        var evGrid = document.createElement('div');
        evGrid.className = 'slot-ev-grid';
        EV_KEYS.forEach(function(k) {
            var cell = document.createElement('div');
            cell.className = 'slot-ev-cell';
            var lbl = document.createElement('label');
            lbl.textContent = k;
            var inp = document.createElement('input');
            inp.type = 'number';
            inp.className = 'slot-ev-input';
            inp.min = '0'; inp.max = '32';
            inp.value = Math.max(0, Math.min(32, p.evs[k] || 0));
            inp.dataset.evKey = k;
            cell.appendChild(lbl);
            cell.appendChild(inp);
            evGrid.appendChild(cell);
        });
        card.appendChild(evGrid);
        partySlots.appendChild(card);
    });
    partyModal.hidden = false;
    document.body.style.overflow = 'hidden';
}

function closePartyModal() {
    partyModal.hidden = true;
    document.body.style.overflow = '';
}

function savePartyFromModal() {
    var cards = partySlots.querySelectorAll('.slot-card');
    var arr = [];
    cards.forEach(function(card) {
        var nameInp   = card.querySelector('.slot-name-input');
        var natureSel = card.querySelector('.slot-nature-select');
        var evInputs  = card.querySelectorAll('.slot-ev-input');
        var evs = {};
        evInputs.forEach(function(inp) {
            evs[inp.dataset.evKey] = Math.max(0, Math.min(32, parseInt(inp.value) || 0));
        });
        arr.push({ name: nameInp.value.trim(), evs: evs, nature: natureSel.value });
    });
    saveParty(arr);
    syncPartySelect(arr);
    closePartyModal();
}

function applyPartyMember(side, member) {
    var pokemon = findPokemon(member.name);
    if (!pokemon) {
        console.warn('[Party] ポケモンが見つかりません:', member.name);
        return;
    }
    var evs    = member.evs || {};
    var nature = member.nature || 'なし（補正なし）';
    var bs     = pokemon.baseStats;

    // ① 名前欄を書き換え → サジェストを非表示
    el[side + 'Name'].value = pokemon.name;

    // ② メガシンカ状態をリセット（通常形態）
    megaState[side].baseName = pokemon.name;
    megaState[side].forms    = getMegaForms(pokemon.name);
    megaState[side].index    = 0;
    updateMegaIndicator(side);

    if (side === 'attacker') {
        var atkKey  = attackMode === 'physical' ? 'A' : 'C';
        var atkBase = attackMode === 'physical' ? bs.atk : bs.spa;
        var atkEv   = Math.max(0, Math.min(32, evs[atkKey] || 0));
        // baseStatにはEV=0時の実数値を記録（setBase方式に従う）
        var atkBase0Real = calcRealStat(atkBase, 0, nature, atkKey);
        var atkReal      = calcRealStat(atkBase, atkEv, nature, atkKey);
        el.attackerStatEv.value               = atkEv;
        el.attackerStat.dataset.baseStat      = String(atkBase0Real);
        el.attackerStat.value                 = atkReal;
    } else {
        // HP
        var hpEv    = Math.max(0, Math.min(32, evs['H'] || 0));
        var hp0Real = calcRealStat(bs.hp, 0, nature, 'H');
        var hpReal  = calcRealStat(bs.hp, hpEv, nature, 'H');
        el.defenderHpEv.value               = hpEv;
        el.defenderHp.dataset.baseStat      = String(hp0Real);
        el.defenderHp.value                 = hpReal;

        // ぼうぎょ / とくぼう
        var defKey  = attackMode === 'physical' ? 'B' : 'D';
        var defBase = attackMode === 'physical' ? bs.def : bs.spd;
        var defEv   = Math.max(0, Math.min(32, evs[defKey] || 0));
        var defBase0Real = calcRealStat(defBase, 0, nature, defKey);
        var defReal      = calcRealStat(defBase, defEv, nature, defKey);
        el.defenderStatEv.value               = defEv;
        el.defenderStat.dataset.baseStat      = String(defBase0Real);
        el.defenderStat.value                 = defReal;
    }

    // ③ ダメージ再計算 → 画像更新
    calculate();
    setArtwork(side, pokemon);
}

partyEditBtn.addEventListener('click', openPartyModal);
modalCloseBtn.addEventListener('click', closePartyModal);
modalSaveBtn.addEventListener('click', savePartyFromModal);
partyModal.addEventListener('click', function(e) {
    if (e.target === partyModal) closePartyModal();
});

el.partyAtkBtn.addEventListener('click', function(e) {
    e.preventDefault();
    var idx = el.partySelect.value;
    console.log('[Party攻] 選択インデックス:', idx);
    if (idx === '') { console.warn('[Party攻] 未選択'); return; }
    try {
        var member = loadParty()[parseInt(idx, 10)];
        console.log('[Party攻] メンバー:', member);
        if (!member) { console.warn('[Party攻] idx が見つからない:', idx); return; }
        applyPartyMember('attacker', member);
    } catch(err) {
        console.error('[Party攻] エラー:', err);
    }
});
el.partyDefBtn.addEventListener('click', function(e) {
    e.preventDefault();
    var idx = el.partySelect.value;
    console.log('[Party防] 選択インデックス:', idx);
    if (idx === '') { console.warn('[Party防] 未選択'); return; }
    try {
        var member = loadParty()[parseInt(idx, 10)];
        console.log('[Party防] メンバー:', member);
        if (!member) { console.warn('[Party防] idx が見つからない:', idx); return; }
        applyPartyMember('defender', member);
    } catch(err) {
        console.error('[Party防] エラー:', err);
    }
});

syncPartySelect(loadParty());

}()); // IIFE 終わり
