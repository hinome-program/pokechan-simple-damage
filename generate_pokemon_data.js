/**
 * generate_pokemon_data.js
 * 実行: node generate_pokemon_data.js
 * PokeAPIから全ポケモンの公式種族値を取得し pokemon_data.js を生成します。
 */

const https = require('https');
const fs    = require('fs');

// ── チャンピオンズロスター（name と id のみ）──────────────────────
const roster = [
    /* Gen 1 */
    { name:'フシギバナ',                        id:3      },
    { name:'リザードン',                        id:6      },
    { name:'カメックス',                        id:9      },
    { name:'スピアー',                          id:15     },
    { name:'ピジョット',                        id:18     },
    { name:'アーボック',                        id:24     },
    { name:'ピカチュウ',                        id:25     },
    { name:'ライチュウ',                        id:26     },
    { name:'ライチュウ(アローラのすがた)',      id:10105  },
    { name:'ピクシー',                          id:36     },
    { name:'キュウコン',                        id:38     },
    { name:'キュウコン(アローラのすがた)',      id:10103  },
    { name:'ウインディ',                        id:59     },
    { name:'ウインディ(ヒスイのすがた)',        id:10230  },
    { name:'フーディン',                        id:65     },
    { name:'カイリキー',                        id:68     },
    { name:'ウツボット',                        id:71     },
    { name:'ヤドラン',                          id:80     },
    { name:'ヤドラン(ガラルのすがた)',          id:10187  },
    { name:'ゲンガー',                          id:94     },
    { name:'ガルーラ',                          id:115    },
    { name:'スターミー',                        id:121    },
    { name:'カイロス',                          id:127    },
    { name:'ケンタロス',                        id:128    },
    { name:'ケンタロス(パルデア・コンバット種)', id:10250 },
    { name:'ケンタロス(パルデア・ブレイズ種)',  id:10251  },
    { name:'ケンタロス(パルデア・ウォーター種)',id:10252  },
    { name:'ギャラドス',                        id:130    },
    { name:'メタモン',                          id:132    },
    { name:'シャワーズ',                        id:134    },
    { name:'サンダース',                        id:135    },
    { name:'ブースター',                        id:136    },
    { name:'プテラ',                            id:142    },
    { name:'カビゴン',                          id:143    },
    { name:'カイリュー',                        id:149    },
    /* Gen 2 */
    { name:'メガニウム',                        id:154    },
    { name:'バクフーン',                        id:157    },
    { name:'バクフーン(ヒスイのすがた)',        id:10233  },
    { name:'オーダイル',                        id:160    },
    { name:'アリアドス',                        id:168    },
    { name:'デンリュウ',                        id:181    },
    { name:'マリルリ',                          id:184    },
    { name:'ニョロトノ',                        id:186    },
    { name:'エーフィ',                          id:196    },
    { name:'ブラッキー',                        id:197    },
    { name:'ヤドキング',                        id:199    },
    { name:'ヤドキング(ガラルのすがた)',        id:10204  },
    { name:'フォレトス',                        id:205    },
    { name:'ハガネール',                        id:208    },
    { name:'ハッサム',                          id:212    },
    { name:'ヘラクロス',                        id:214    },
    { name:'エアームド',                        id:227    },
    { name:'ヘルガー',                          id:229    },
    { name:'バンギラス',                        id:248    },
    /* Gen 3 */
    { name:'ペリッパー',                        id:279    },
    { name:'サーナイト',                        id:282    },
    { name:'ヤミラミ',                          id:302    },
    { name:'ボスゴドラ',                        id:306    },
    { name:'チャーレム',                        id:308    },
    { name:'ライボルト',                        id:310    },
    { name:'サメハダー',                        id:319    },
    { name:'バクーダ',                          id:323    },
    { name:'コータス',                          id:324    },
    { name:'チルタリス',                        id:333    },
    { name:'ミロカロス',                        id:350    },
    { name:'ポワルン',                          id:351    },
    { name:'ジュペッタ',                        id:354    },
    { name:'チリーン',                          id:358    },
    { name:'アブソル',                          id:359    },
    { name:'オニゴーリ',                        id:362    },
    /* Gen 4 */
    { name:'ドダイトス',                        id:389    },
    { name:'ゴウカザル',                        id:392    },
    { name:'エンペルト',                        id:395    },
    { name:'ロズレイド',                        id:407    },
    { name:'ラムパルド',                        id:409    },
    { name:'トリデプス',                        id:411    },
    { name:'ミミロップ',                        id:428    },
    { name:'ミカルゲ',                          id:442    },
    { name:'ガブリアス',                        id:445    },
    { name:'ルカリオ',                          id:448    },
    { name:'カバルドン',                        id:450    },
    { name:'ドクロッグ',                        id:454    },
    { name:'ユキノオー',                        id:460    },
    { name:'マニューラ',                        id:461    },
    { name:'ドサイドン',                        id:464    },
    { name:'リーフィア',                        id:470    },
    { name:'グレイシア',                        id:471    },
    { name:'グライオン',                        id:472    },
    { name:'マンムー',                          id:473    },
    { name:'エルレイド',                        id:475    },
    { name:'ユキメノコ',                        id:478    },
    { name:'ロトム',                            id:479    },
    { name:'ヒートロトム',                      id:10007  },
    { name:'ウォッシュロトム',                  id:10008  },
    { name:'フロストロトム',                    id:10009  },
    { name:'スピンロトム',                      id:10010  },
    { name:'カットロトム',                      id:10011  },
    /* Gen 5 */
    { name:'ジャローダ',                        id:497    },
    { name:'エンブオー',                        id:500    },
    { name:'ダイケンキ',                        id:503    },
    { name:'ダイケンキ(ヒスイのすがた)',        id:10236  },
    { name:'ミルホッグ',                        id:505    },
    { name:'レパルダス',                        id:510    },
    { name:'ヤナッキー',                        id:512    },
    { name:'バオッキー',                        id:513    },
    { name:'ヒヤッキー',                        id:514    },
    { name:'ドリュウズ',                        id:530    },
    { name:'タブンネ',                          id:531    },
    { name:'ローブシン',                        id:534    },
    { name:'エルフーン',                        id:547    },
    { name:'ワルビアル',                        id:553    },
    { name:'デスカーン',                        id:563    },
    { name:'ダストダス',                        id:569    },
    { name:'ゾロアーク',                        id:571    },
    { name:'ゾロアーク(ヒスイのすがた)',        id:10238  },
    { name:'ランクルス',                        id:579    },
    { name:'バイバニラ',                        id:584    },
    { name:'エモンガ',                          id:587    },
    { name:'シャンデラ',                        id:609    },
    { name:'ツンベアー',                        id:614    },
    { name:'マッギョ',                          id:618    },
    { name:'マッギョ(ガラルのすがた)',          id:10195  },
    { name:'ゴルーグ',                          id:623    },
    { name:'サザンドラ',                        id:635    },
    { name:'ウルガモス',                        id:637    },
    /* Gen 6 */
    { name:'ブリガロン',                        id:652    },
    { name:'マフォクシー',                      id:655    },
    { name:'ゲッコウガ',                        id:658    },
    { name:'ホルード',                          id:660    },
    { name:'ファイアロー',                      id:663    },
    { name:'ビビヨン',                          id:666    },
    { name:'フラージェス',                      id:671    },
    { name:'ゴーゴート',                        id:673    },
    { name:'ゴロンダ',                          id:675    },
    { name:'トリミアン',                        id:676    },
    { name:'ニャオニクス(オスのすがた)',        id:678    },
    { name:'ニャオニクス(メスのすがた)',        id:10050  },
    { name:'ギルガルド',                        id:681    },
    { name:'フレフワン',                        id:685    },
    { name:'ペロリーム',                        id:683    },
    { name:'ブロスター',                        id:689    },
    { name:'エレザード',                        id:695    },
    { name:'ガチゴラス',                        id:697    },
    { name:'アマルルガ',                        id:699    },
    { name:'ニンフィア',                        id:700    },
    { name:'ルチャブル',                        id:701    },
    { name:'デデンネ',                          id:702    },
    { name:'ヌメルゴン',                        id:706    },
    { name:'ヌメルゴン(ヒスイのすがた)',        id:10240  },
    { name:'クレッフィ',                        id:707    },
    { name:'オーロット',                        id:709    },
    { name:'パンプジン(ちいさいサイズ)',        id:711    },
    { name:'パンプジン(ふつうのサイズ)',        id:711    },
    { name:'パンプジン(おおきいサイズ)',        id:711    },
    { name:'パンプジン(とくだいサイズ)',        id:711    },
    { name:'クレベース',                        id:713    },
    { name:'クレベース(ヒスイのすがた)',        id:10241  },
    { name:'オンバーン',                        id:715    },
    /* Gen 7 */
    { name:'ジュナイパー',                      id:724    },
    { name:'ジュナイパー(ヒスイのすがた)',      id:10243  },
    { name:'ガオガエン',                        id:727    },
    { name:'アシレーヌ',                        id:730    },
    { name:'ドデカバシ',                        id:733    },
    { name:'クワガノン',                        id:738    },
    { name:'ルガルガン(まひるのすがた)',        id:745    },
    { name:'ルガルガン(まよなかのすがた)',      id:10126  },
    { name:'ルガルガン(たそがれのすがた)',      id:10152  },
    { name:'ドヒドイデ',                        id:748    },
    { name:'バンバドロ',                        id:750    },
    { name:'オニシズクモ',                      id:752    },
    { name:'エンニュート',                      id:758    },
    { name:'アマージョ',                        id:763    },
    { name:'ヤレユータ',                        id:765    },
    { name:'ナゲツケサル',                      id:766    },
    { name:'ミミッキュ',                        id:778    },
    { name:'ジジーロン',                        id:780    },
    { name:'ジャラランガ',                      id:784    },
    /* Gen 8 */
    { name:'アーマーガア',                      id:823    },
    { name:'アップリュー',                      id:841    },
    { name:'タルップル',                        id:842    },
    { name:'サダイジャ',                        id:844    },
    { name:'ポットデス',                        id:855    },
    { name:'ブリムオン',                        id:858    },
    { name:'バリコオル',                        id:866    },
    { name:'サニゴーン',                        id:864    },
    { name:'マホイップ',                        id:869    },
    { name:'モルペコ',                          id:877    },
    { name:'ドラパルト',                        id:887    },
    /* Hisui */
    { name:'アヤシシ',                          id:899    },
    { name:'バサギリ',                          id:900    },
    { name:'イダイトウ(オスのすがた)',          id:901    },
    { name:'イダイトウ(メスのすがた)',          id:'basculegion-female' },
    { name:'オオニューラ',                      id:903    },
    /* Gen 9 */
    { name:'マスカーニャ',                      id:908    },
    { name:'ラウドボーン',                      id:911    },
    { name:'ウェーニバル',                      id:914    },
    { name:'イッカネズミ',                      id:925    },
    { name:'キョジオーン',                      id:934    },
    { name:'グレンアルマ',                      id:936    },
    { name:'ソウブレイズ',                      id:937    },
    { name:'ハラバリー',                        id:939    },
    { name:'リククラゲ',                        id:945    },
    { name:'タイカイデン',                      id:941    },
    { name:'デカヌチャン',                      id:959    },
    { name:'イルカマン',                        id:964    },
    { name:'ミミズズ',                          id:968    },
    { name:'キラフロル',                        id:970    },
    { name:'リキキリン',                        id:976    },
    { name:'ドドゲザン',                        id:983    },
    { name:'ウミトリオ',                        id:961    },
    { name:'ブリジュラス',                      id:998    },
    { name:'カミツオロチ',                      id:1019   },
];

// ── PokeAPIからstatsを取得 ─────────────────────────────────────
function fetchStats(id) {
    return new Promise((resolve, reject) => {
        const url = `https://pokeapi.co/api/v2/pokemon/${id}`;
        https.get(url, { headers: { 'User-Agent': 'poketyan-build/1.0' } }, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(raw);
                    const g = name => json.stats.find(s => s.stat.name === name)?.base_stat ?? 0;
                    resolve({
                        hp:  g('hp'),
                        atk: g('attack'),
                        def: g('defense'),
                        spa: g('special-attack'),
                        spd: g('special-defense'),
                        spe: g('speed'),
                    });
                } catch(e) { reject(new Error(`Parse error: ${e.message}`)); }
            });
        }).on('error', reject);
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── メイン処理 ────────────────────────────────────────────────
async function main() {
    console.log(`\n🔥 PokeAPI から ${roster.length} 体分の種族値を取得します...\n`);

    const cache   = new Map();  // 同じidの重複取得を防ぐ
    const results = [];
    let   errors  = 0;

    for (const p of roster) {
        const key = String(p.id);

        if (cache.has(key)) {
            const bs = cache.get(key);
            results.push({ name: p.name, id: p.id, baseStats: bs });
            console.log(`  [cache] ${p.name}`);
            continue;
        }

        try {
            process.stdout.write(`  Fetching ${p.name} (${p.id})... `);
            const bs = await fetchStats(p.id);
            cache.set(key, bs);
            results.push({ name: p.name, id: p.id, baseStats: bs });
            console.log(`HP:${bs.hp} ATK:${bs.atk} DEF:${bs.def} SPA:${bs.spa} SPD:${bs.spd} SPE:${bs.spe}`);
            await sleep(150); // レートリミット回避
        } catch(e) {
            console.error(`ERROR: ${e.message}`);
            results.push({ name: p.name, id: p.id, baseStats: null });
            errors++;
        }
    }

    // pokemon_data.js として出力（window.POKEMON_DATA グローバル変数）
    // → <script src="pokemon_data.js"> で読み込め、file://でも動作する
    const jsContent = `// pokemon_data.js — PokeAPIから自動生成（generate_pokemon_data.js）
// Generated: ${new Date().toISOString()}
// ${results.length} Pokemon / ${errors} errors
/* global window */
window.POKEMON_DATA = ${JSON.stringify(results, null, 2)};
`;

    fs.writeFileSync('./pokemon_data.js', jsContent, 'utf8');

    console.log(`\n✅ 完了: pokemon_data.js を生成しました`);
    console.log(`   ${results.length} 体登録 / エラー ${errors} 件`);
    if (errors > 0) {
        console.log(`   ⚠️  エラーがあったポケモンは手動で修正してください`);
    }
}

main().catch(console.error);
