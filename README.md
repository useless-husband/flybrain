# 果蠅大腦模擬 FlyBrain

> **English:** A browser-based simulation of the *Drosophila melanogaster* (fruit fly) brain: 139,255 leaky integrate-and-fire neurons and about 2.7 million connections from the public [FlyWire FAFB v783](https://codex.flywire.ai) connectome, simulated in real time inside a Web Worker. This repository is a Traditional Chinese (zh-TW) adaptation of [snedea/flybrain](https://github.com/snedea/flybrain) that adds a hands-on "training ground": you write the synaptic learning rule yourself (in JavaScript or Python) and try to teach the fly that an odor predicts sugar. Developed with the help of Claude.

## 這是什麼

這是一隻「活在瀏覽器裡」的果蠅。牠的大腦不是寫死的劇本，而是真的用 FlyWire 團隊描繪出來的 **139,255 顆神經元、2,698,236 條連線**，以漏電積分放電（LIF）模型一格一格算出來的。你放食物牠會聞到並走過去吃、碰牠會嚇到、關燈牠會換方向走，這些行為都是訊號在神經網路裡傳遞後「冒出來」的。

這個版本在原作 [snedea/flybrain](https://github.com/snedea/flybrain) 之上做了幾件事：

- **全面繁體中文化**：工具列、操作說明、教學導覽、神經元群名稱、行為狀態全部翻成繁體中文（`js/zh-tw.js`、`js/education.js`）。
- **訓練場**：新增一個實驗台（`js/training.js`），可以對蒼蠅重複「給氣味＋給糖」，再量牠「想靠近」的神經元放電多少，看牠有沒有學會。
- **自己寫學習規則**：真正決定牠會不會學的，是 `js/learning-rule.js` 這一個函式。預設什麼都不做（所以牠學不會），由你來改。卡住可以看 `js/learning-rule.參考解答.js`。
- **Python 版**：`python/` 底下用 numpy / scipy 把同一份大腦、同一套規則整個算一遍，可以離線跑訓練實驗、畫學習曲線，甚至讓牠「學 Python 關鍵字」。
- **本機伺服器**：`server.py` 會把所有文字檔以 UTF-8 送出，中文才不會變亂碼。

## 怎麼啟動

需要 Python 3（macOS 內建就有）和一個支援 WebGL2 的瀏覽器（Chrome、Safari、Firefox 都可以）。

```sh
./start.sh
```

`start.sh` 會啟動 `server.py`（監聽 IPv6 loopback `[::1]` 的 8899 埠）並自動打開瀏覽器。如果沒有自動開，手動到：

```
http://[::1]:8899/index.html
```

> 為什麼綁 `::1` 而不是 `localhost`：開發用的那台 Mac 當時 IPv4 loopback 壞掉了，所以寫成 IPv6。一般電腦兩種都通。如果你的環境不支援 IPv6，也可以直接在專案資料夾執行 `python3 -m http.server 8899`，再打開 `http://localhost:8899/index.html`。

第一次載入會讀 12 MB 的 `data/connectome.bin.gz`，要等幾秒；左邊的「神經接線圖」出現數字就是載好了。

### 畫面上可以做的事

| 工具 | 效果 |
| --- | --- |
| 餵食 | 點畫面放食物，牠餓了會自己找過去吃 |
| 觸碰 | 點牠身上。頭、胸、腹、腳會引發不同的理毛動作；4 秒內連點 3 下會看到痛覺反應 |
| 吹風 | 在牠附近按住拖曳，拖愈遠風愈強 |
| 光線 / 溫度 | 切換環境，觀察趨光性與躁動／探索行為的變化 |
| 3D 大腦 | 用 Three.js 看各腦區即時亮起 |
| 教學導覽 | 逐一介紹視葉、觸角葉、蕈狀體、中央複合體等腦區 |
| 訓練場 | 做「氣味 → 糖水」的制約實驗（見下節） |
| 省電模式 | 筆電電池吃緊時用 |

左側會以 WebGL 把全部 13.9 萬顆神經元畫成點，依感覺輸入、中樞處理、內在驅力、運動輸出分區，亮度就是放電狀態。

## 訓練場：讓牠學會「這個氣味 = 有好事」

蒼蠅腦裡有 21,438 條「氣味 → 想靠近」的突觸（蕈狀體 KC → MBON_APP）。每一格模擬時間（0.1 秒），`learningRule(s)` 會對每一條突觸被呼叫一次，你回傳的數字就是那條突觸的新強度：

| 欄位 | 意思 |
| --- | --- |
| `s.strength` | 這條突觸現在的強度，1.0 = 原本 |
| `s.trace` | 最近有多活躍，1 = 剛用到、0 = 很久沒動 |
| `s.reward` | 現在有沒有多巴胺獎勵（0 ～ 1，會慢慢衰減） |
| `s.punish` | 現在有沒有懲罰，同上 |

流程：

1. 打開 `js/learning-rule.js`（雙擊 `開啟規則檔.command` 會用 VS Code 開）。
2. 改完存檔，回到瀏覽器按訓練場的「重新載入規則」，不用重開頁面。寫錯也沒關係，錯誤訊息會直接顯示在訓練場裡。
3. 先按「測基準」，再按幾次「獎勵訓練」，看「想靠近」的放電數有沒有往上爬。

### Python 版（離線跑、可以畫圖）

```sh
cd python
pip3 install numpy scipy matplotlib   # matplotlib 只有畫圖才需要
python3 train.py                       # 測基準 → 每訓練 2 次測一次，共 10 次獎勵訓練
python3 train.py --trials 20 --punish  # 後半段改成懲罰，看牠會不會忘記
python3 learn_python.py --ask prnt whlie   # 把 Python 關鍵字當氣味餵牠，再考沒看過的字
```

- `flybrain.py`：Python 版大腦，讀同一份 `data/`，常數跟瀏覽器版 `sim-worker.js` 對齊。通常不用改。
- `learning_rule.py`：你的規則（numpy 向量版）。`learning_rule_參考解答.py` 是參考答案。
- `train.py` 會把學習曲線存成 `學習曲線.png`；`learn_python.py` 存成 `學Python曲線.png`。
- `跑訓練.command`、`學Python.command`：雙擊就跑，給不想開終端機的人。

## 檔案結構

```
index.html            主頁面（繁體中文介面）
start.sh / server.py  本機伺服器（UTF-8、不快取）
css/main.css
js/
  constants.js        59 組功能神經元群的簡化權重表（fallback 用）
  connectome.js       訊號傳遞核心（源自 worm-sim）
  sim-worker.js       LIF 全腦模擬 Web Worker（139K 神經元）
  brain-worker-bridge.js  主執行緒 ↔ Worker 橋接、載入 connectome.bin.gz
  neuro-renderer.js   WebGL2 把 13.9 萬顆神經元畫成點
  brain3d.js          Three.js 3D 腦區
  fly-logic.js / main.js  行為狀態機與 2D 果蠅繪製
  education.js        教學導覽（已中文化）
  zh-tw.js            繁體中文化補丁（只改顯示文字，不動邏輯）
  training.js         訓練場
  learning-rule.js    你的學習規則（JS 版）
  caretaker-*.js      原作的選配「照護者」介面，會嘗試連本機 7600 埠；沒有該服務時不影響模擬
  vendor/             three.js、OrbitControls
data/
  connectome.bin.gz   139,255 顆神經元 + 2,698,236 條邊（二進位，約 12 MB）
  neuron_meta.json    63 組神經元群的名稱、所屬腦區、數量
python/               Python 版大腦與訓練腳本
svg/                  工具列圖示
```

`connectome.bin.gz` 的格式（little-endian）：表頭 2 個 uint32（神經元數、邊數），接著每條邊 `uint32 pre, uint32 post, float32 weight`，最後每顆神經元 `uint8 region_type, uint16 group_id`。

## 資料來源

神經元與連線資料來自 **FlyWire 全腦連接體**（公開資料集，FAFB v783）：

> Dorkenwald, S., Matsliah, A., Sterling, A.R. *et al.* Neuronal wiring diagram of an adult brain. *Nature* **634**, 124–138 (2024). https://doi.org/10.1038/s41586-024-07558-y

`data/connectome.bin.gz` 與 `data/neuron_meta.json` 直接沿用自原作 [snedea/flybrain](https://github.com/snedea/flybrain)，由原作者從 [FlyWire Codex](https://codex.flywire.ai) 公開資料轉成二進位，並依 FlyWire 的細胞類型標註把神經元分成感覺、中樞、驅力、運動四大類與 63 個功能群。FlyWire 只涵蓋腦部，腳與翅膀的運動神經元是用簡化群組代替。

## 來源與致謝

- [snedea/flybrain](https://github.com/snedea/flybrain)（MIT）：本專案的直接上游，139K 神經元的瀏覽器模擬就是他做的。
- [heyseth/worm-sim](https://github.com/heyseth/worm-sim)（MIT, © 2017 Seth Miller）：原作的上游，302 顆神經元的秀麗隱桿線蟲模擬。
- Timothy Busbice、Gabriel Garrett、Geoffrey Churchill 的 [GoPiGo Connectome](https://github.com/Connectome/GoPiGo) 與 [Zach Rispoli](https://github.com/zrispo) 的 JavaScript 移植：連接體驅動行為的原始概念。
- **FlyWire Consortium**：公開完整的成年果蠅腦連接體。

## 開發方式

繁體中文化、訓練場、學習規則介面、Python 版與這份 README，都是和 Claude（Anthropic 的 AI 助理）一起寫的：由人決定要做什麼、實際測試、調參數，Claude 負責大部分程式碼。

## 授權

MIT License，見 [LICENSE](LICENSE)。衍生自原作的部分同時受原作的 MIT 授權保護。
