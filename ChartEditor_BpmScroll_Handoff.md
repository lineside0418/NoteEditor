# 譜面エディタ向け仕様: BPM変化とソフラン

この文書は、外部譜面エディタが Re-Inverse の現行ランタイムと一致する譜面 JSON を読み書きし、再生位置をプレビューするための引き渡し仕様である。対象は MusicPackages の `charts/{low,mid,high,sp}.json`（RICF-1、`version: 1`）。曲情報、保存先、難易度名などの全体契約は [MusicPackages_ChartEditor_Integration.md](MusicPackages_ChartEditor_Integration.md) を参照する。ゲーム側の計算と検証記録は [GameScene_TimingScroll_Implementation.md](GameScene_TimingScroll_Implementation.md) を参照する。

## 1. データの正本と役割

| 譜面 JSON の値 | 単位・意味 | ゲームへの影響 |
| --- | --- | --- |
| `metadata.resolution` | 四分音符あたりの Tick 数。通常は `960` | Tick と秒の換算 |
| `timing.bpms[].tick` / `.bpm` | その Tick から適用する BPM | ノーツ・ギミックの時刻、判定時刻、現在 BPM 表示 |
| `timing.scrolls[].tick` / `.speed` / 任意の`.endTick`・`.easing` | 瞬時切替、または指定Tick区間での正の表示速度倍率の補間 | ノーツと小節線の流れる距離・速度、スポーン時刻 |
| `metadata.audio.offset` | 音声と譜面の同期用ミリ秒。負値可 | 音声と譜面時刻の相対位置。BPM/Scroll の代用ではない |
| `metadata.grid_offset` | 拍子の分母音符単位の符号付き整数 | 小節線の位相だけ。音声・ノーツ・判定時刻は動かさない |

これらは**各難易度の譜面 JSON**に保存する。`metadata/songdata.json` に BPM や Scroll を複製しない。`scrolls.speed` はユーザーのハイスピード設定に掛かる譜面固有の倍率であり、音声の再生速度、BPM、判定幅、スコアには影響しない。

## 2. JSON 形式

以下はタイミングを含む有効な譜面の例。`notes` と `events` は説明用の空配列である。

```json
{
  "version": 1,
  "metadata": {
    "charter": "Chart Author",
    "difficulty": { "level": 15.5 },
    "audio": { "offset": -120 },
    "grid_offset": 0,
    "laneCount": 7,
    "resolution": 960
  },
  "timing": {
    "bpms": [
      { "tick": 0, "bpm": 120.0 },
      { "tick": 1920, "bpm": 240.0 }
    ],
    "scrolls": [
      { "tick": 960, "speed": 0.5 },
      { "tick": 2880, "speed": 2.0 }
    ],
    "timeSignatures": [{ "tick": 0, "numerator": 4, "denominator": 4 }],
    "stops": []
  },
  "notes": [],
  "events": []
}
```

- `bpms` は **Tick 0 のイベントが必須**。各イベントは指定 Tick から瞬時に有効になる。
- `scrolls` は `[]` にでき、その場合は全区間 `1.0` 倍。最初の Scroll イベントより前も `1.0` 倍。Tick 0 にイベントがあれば、その値を冒頭から使う。
- `bpms` と `scrolls` はそれぞれ同じ配列の中で Tick を重複させない。両配列に**同じ Tick**のイベントを置くことは可能で、両方がその Tick から適用される。
- ゲーム側は配列を Tick 順にソートして処理する。エディタは表示、保存、差分確認のため昇順に正規化して出力する。
- `speed` は固定速度そのものではなく、区間に掛ける倍率である。`0.5` は半速、`2.0` は倍速。`endTick`なしなら従来どおり瞬時切替、指定した場合はそのTickで到達する目標倍率である。

## 3. Tick から判定時刻への変換

`resolution = R`、現在の区間の BPM を `B` とすると、区間内の `Δtick` が占める秒数は次のとおり。

```text
Δseconds = Δtick × 60 / (R × B)
```

Tick 0 を譜面時刻 0 秒とし、BPM 境界までの秒数を区間ごとに積み上げる。ある BPM イベントが Tick `k` にある場合、`k` までの経過時間には**直前の BPM**を使用し、`k` 以降には**新しい BPM**を使用する。ノーツの頭、Hold/Shift の末尾、Swap/Scramble の発火時刻はいずれも該当 Tick をこの方法で秒に変換する。BPM の変更だけでは「1 秒あたりの基本的な移動距離」は変更しないため、画面上では変更点を境にノーツの時間間隔が変わる。

`metadata.audio.offset` は上記の Tick→譜面秒の計算へ足し込まない。ゲームは譜面時刻の原点に対して音声開始を `offset / 1000` 秒ずらす。音源ファイル上の再生秒を表示するエディタでは、概念上 `譜面時刻 = 音源再生秒 − offset/1000` として同期する。エディタのタイムライン内部では「譜面時刻」と「音源再生秒」を混同しない。

## 4. ソフランと位置プレビュー

まず Scroll イベントの Tick を第 3 節の BPM マップで**譜面秒**へ変換する。`endTick`のないScrollはその秒から新しい `speed` に瞬時に切り替わる。`endTick`付きは次の規則で滑らかに変化する。BPM が変わっても固定`speed`区間の秒あたりの基本流速は一定である。

### 滑らかな速度変化フェーズ

```json
"scrolls": [
  { "tick": 0, "speed": 1.0 },
  { "tick": 960, "endTick": 1920, "speed": 2.0, "easing": "inQuad" },
  { "tick": 2880, "speed": 0.75 }
]
```

Tick 960から1920まで1.0→2.0倍へ変化し、Tick 1920以降は2.0倍を保持する。Tick 2880で0.75倍に瞬時切替する。フェーズの開始倍率は開始直前の有効倍率から自動的に決める。先行イベントがなければ1.0。`easing`を省略したフェーズは`linear`とする。フェーズをTick 0から始めた場合、負のプリロール中は1.0倍である。旧形式のTick 0瞬時切替はプリロールにもその倍率を適用する。

`u = (現在Tick − tick) / (endTick − tick)` を0〜1に制限し、倍率を `開始倍率 + (speed − 開始倍率) × f(u)` とする。`linear`は`f(u)=u`、`inQuad`は`u²`、`outQuad`は`1−(1−u)²`。**Tick基準**なのでフェーズ途中のBPM変化は実時間上の進み方を変えるが、Tickごとの倍率は変えない。視覚時間の積分はBPM境界で分割し、各区間の`倍率 × 秒/Tick`を使う。指定Tickを超えてから倍率を一括適用したり、倍率の単純なTick平均を秒数に掛けたりしない。

同じ`tick`を持つScrollイベントは不可。フェーズ用の`endTick`は`tick`より大きい整数とし、次のScrollイベントの`tick`は直前の`endTick`以降にする。UnityのJSONモデルでは省略した`endTick`は0として扱われ、明示的な0も瞬時切替になる。エディタは旧形式では項目を省略する。終了Tickと次の開始Tickは一致してよく、その時点で次のイベントを適用する。`easing`は`linear`、`inQuad`、`outQuad`だけを出力し、`endTick`のないイベントへは付けない。既存の`{tick,speed}`を開いて再保存するときに`endTick`や`easing`を勝手に追加しない。

ギミックがない通常ノーツ・小節線のための「視覚時間」`V(t)` は、譜面時刻 `t` までの Scroll 倍率の積分である。

```text
V(t) = ∫[0, t] scrollSpeed(u) du
表示上の残距離 = (V(判定時刻) − V(現在の譜面時刻)) × ユーザー設定に由来する基本速度
```

つまり、**判定時刻そのものは動かず**、判定線へ近づく過程だけが変わる。過去の区間で増えた視覚時間を保持して連続した位置を計算する。速度変更点でノーツをワープさせたり、`(判定時刻 − 現在時刻) × 現在の speed` だけで全距離を再計算したりしない。プレビューの時間軸に速度変化を反映するなら、BPM で得た秒をさらにこの累積視覚時間へ変換する。

ゲームはロード時に BPM/Scroll と Shift/Scramble の境界を結合し、区間の累積視覚時間、各ノーツの頭・末尾の値、スポーン時刻を前計算する。エディタ側でも、イベント変更時に区間表を更新してからプレビューを描くと、境界の前後が安定する。ゲームと同等の位置精度が必要な計算には倍精度を使い、表示に渡す最後の段階で変換する。

### ギミックを含むプレビュー

ゲーム内の有効な視覚速度は `Scroll × Shift × Scramble`。Shift が対象となる通常レーン（JSON lane `0..5`）のノーツ端点は、対象の Shift 区間ごとに `0.5` 倍される。重なればその積を使う。中央 lane `6` と Shift ノーツ自身には、このノーツ固有の Shift 倍率を付けない。Hold/Shift の**頭と末尾は別々のプロファイル**で計算するため、片方だけが Shift 区間に入ることがある。Scramble の表示倍率はその発火時刻から設定されたアニメーション期間で補間される。期間は譜面 JSON ではなくゲーム設定が所有する。Swap/Scramble の発火 Tick は BPM に従い、Swap で変わる左右位置はゲーム側の論理レーン→表示レーン対応に従う。Scroll の実装だけでノーツの左右位置を再定義しない。

エディタがギミック付きのゲーム画面プレビューを提供しない場合でも、JSON の Tick とイベントをそのまま保持する。単純な BPM/Scroll プレビューを「Shift/Scramble を含むゲームと完全一致」と表示しない。

## 5. 数値例

第 2 節の例で `resolution = 960`。Scroll の Tick 0 イベントはないため、初期倍率は `1.0`。

| Tick | 適用 BPM | 譜面時刻 | 適用 Scroll | 累積視覚時間 `V` |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 120 | 0.000 秒 | 1.0 | 0.000 |
| 960 | 120 | 0.500 秒 | 0.5 | 0.500 |
| 1920 | 240 | 1.000 秒 | 0.5 | 0.750 |
| 2880 | 240 | 1.250 秒 | 2.0 | 0.875 |
| 3840 | 240 | 1.500 秒 | 2.0 | 1.375 |

例えば Tick 3840 の Tap は **1.500 秒に判定**される。Tick 2880 の Scroll 切替以降に進む視覚時間は `(1.500 − 1.250) × 2.0 = 0.500` で、判定位置は変わらない。Tick 1920 ではその時点まで 120 BPM の時間を積み上げ、その Tick 以降を 240 BPM で計算する。

## 6. 保存前の検証と未対応機能

エディタは少なくとも以下を保存前に検証し、違反時は明示的なエラーを出す。

1. `metadata.resolution` が正の整数で、`timing.bpms` に Tick 0 がある。
2. BPM と Scroll の各 Tick が `0` 以上の整数で、それぞれの配列内に重複がない。
3. `bpm` と `speed` が有限の数値で、いずれも **0 より大きい**。
4. ノーツ・ギミック・Scroll の時刻プレビューは、常に同じ BPM マップから変換する。
5. 再保存で `bpms` / `scrolls` / `timeSignatures` / `stops` を欠落させず、既存イベントの値を勝手に丸めたり別 Tick へ動かしたりしない。
6. Scrollフェーズの`endTick > tick`、有効な`easing`、フェーズ同士および他Scrollイベントとの非重複を確認する。

`speed: 0` による停止、負の `speed` による逆走、`timing.stops` の適用は**現行ゲームランタイムでは未対応**。ゲームの `ChartManager` は `speed <= 0` をロード時に拒否する。`timing.stops` という JSON 項目が存在しても、BPM 時刻や視覚時間に反映しない。エディタが将来用のデータとして保持する場合は、ゲームで再生できる機能として表示しない。`events.parameters` も現行ランタイムの適用対象ではない。

## 7. エディタの受け入れ確認

- 第 5 節の Tick→秒、Scroll 切替秒、累積視覚時間の値を確認する。BPM と Scroll が同じ Tick にある場合も確認する。
- BPM だけを変えた場合、ノーツの判定秒は変わり、同じ秒数に対する基本流速は変わらない。Scroll だけを変えた場合、判定秒・音源位置・採点は変わらず、画面上の接近速度が変わる。
- `scrolls: []` と Tick 0 の Scroll 省略を確認する。重複 Tick、負 Tick、`0`・負数・非有限値を拒否する。
- 120 BPM・960 Tick/拍でTick 0〜960を1→2倍にしたとき、終了時の累積視覚時間はLinear=0.75秒、InQuad=2/3秒、OutQuad=5/6秒。途中にBPM変更が入る場合はBPM境界で積分を分割し、終了時の倍率は指定目標値に一致させる。
- Hold の頭・末尾、Shift/Scramble 前後、Swap 発火 Tick、小節線を、同じ BPM マップに基づいて表示する。ギミックの視覚再現を実装する場合は第 4 節の端点別プロファイルも検証する。
- 保存→再読み込み→再保存でイベントと Tick を保持し、Unity 側では `Re-Inverse/Validate Chart Timing and Scroll` と `Re-Inverse/Rebuild MusicPackages Catalog` を実行する。実際のゲーム画面で速度境界、Pause/Resume、Retry を確認する。

本書は **2026-10-19 時点のUnity側契約** `ChartManager.cs`、`GameManager.cs`、`BaseNote.cs`、`HoldNote.cs` と既存の MusicPackages 契約に基づく。別プロジェクトの譜面エディタ本体は、この仕様に合わせて編集UI、保存、プレビュー計算を更新する必要がある。
