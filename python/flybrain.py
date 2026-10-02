# -*- coding: utf-8 -*-
"""
flybrain.py —— 果蠅全腦模擬的 Python 版本。

跟瀏覽器版是同一份資料（FlyWire 139,255 顆神經元、2,698,236 條突觸），
同一套規則（漏電積分放電 LIF），只是用 numpy / scipy 一次算整個腦。

你通常不需要改這個檔案。你要改的是 learning_rule.py 和 train.py。
"""
import gzip
import json
import struct
import importlib
from pathlib import Path

import numpy as np
import scipy.sparse as sp

ROOT = Path(__file__).resolve().parent.parent          # FlyBrain/
DATA = ROOT / "data"


class FlyBrain:
    # 這些常數跟瀏覽器版 sim-worker.js 一樣
    LEAK = 0.95            # 每一格電壓留下 95%（漏電）
    THRESHOLD = 1.0        # 電壓超過 1.0 就放電
    REFRACTORY = 3         # 放電後 3 格不能再放
    GAIN = 2.0             # 突觸縮放：每顆神經元的興奮性輸入總權重正規化成這個值
                           #   （瀏覽器版用「除以全域最大值」，離群值會把整個網路壓到傳不動；
                           #    這裡改成每顆神經元各自正規化，訊號才能一層一層傳下去。
                           #    實測：1.5~2.5 傳得動又會安靜下來，3.0 以上會全腦停不下來）
    STIM = 0.30            # 外部刺激一格加多少電壓（0.3 → 大約每 5 格放電一次）
    TRACE_DECAY = 0.85     # 活躍痕跡每格衰減
    DOPA_DECAY = 0.7       # 多巴胺訊號每格衰減
    STRENGTH_MIN, STRENGTH_MAX = 0.0, 3.0

    def __init__(self, verbose=True, kc_sparsity=None):
        """kc_sparsity：例如 0.05 → 模擬 APL 抑制神經元，每格只讓電壓最高的 5% KC 放電
        （稀疏編碼：真實果蠅靠這個讓不同氣味用不同的 KC 子集表示，才分得出來）"""
        self.kc_sparsity = kc_sparsity
        meta = json.load(open(DATA / "neuron_meta.json", encoding="utf-8"))
        self.G = meta["group_count"]
        self.group_names = [""] * self.G
        self.name2id = {}
        for g in meta["groups"]:
            self.group_names[g["id"]] = g["name"]
            self.name2id[g["name"]] = g["id"]

        raw = gzip.open(DATA / "connectome.bin.gz").read()
        N, E = struct.unpack_from("<II", raw, 0)
        self.N, self.E = N, E
        edges = np.frombuffer(raw, dtype=np.dtype([("pre", "<u4"), ("post", "<u4"), ("w", "<f4")]),
                              count=E, offset=8)
        mb = np.frombuffer(raw, dtype=np.uint8, count=N * 3, offset=8 + E * 12).reshape(N, 3)
        self.region = mb[:, 0].copy()
        self.group = np.ascontiguousarray(mb[:, 1:3]).view("<u2").ravel().astype(np.int64)

        # Wt[post, pre] = 權重；這樣「V += Wt @ fired」就是把所有放電神經元的訊號送到下游
        self.Wt = sp.csr_matrix((edges["w"].astype(np.float32), (edges["post"], edges["pre"])),
                                shape=(N, N), dtype=np.float32)
        self._rows = np.repeat(np.arange(N), np.diff(self.Wt.indptr))   # 每條突觸的 post
        self._cols = self.Wt.indices                                     # 每條突觸的 pre
        # 突觸縮放：讓每顆神經元的興奮性輸入加總 = GAIN
        pos_in = np.asarray(self.Wt.multiply(self.Wt > 0).sum(axis=1)).ravel()
        factor = np.where(pos_in > 0, self.GAIN / np.maximum(pos_in, 1e-9), 0.0).astype(np.float32)
        self.Wt.data *= factor[self._rows]

        self.V = np.zeros(N, np.float32)
        self.fired = np.zeros(N, bool)
        self.refr = np.zeros(N, np.uint8)
        self.last_spikes = np.zeros(self.G, np.int64)
        self.tick_count = 0
        self._kc_idx = np.where(self.group == self.name2id["MB_KC"])[0]

        # 可塑性
        self.plastic = False
        self.learning = True          # False = 凍住可塑性（例如考試的時候）
        self.rule = None
        self.rule_error = None
        self.reward = 0.0
        self.punish = 0.0

        if verbose:
            print(f"大腦載入完成：{N:,} 顆神經元、{E:,} 條突觸、{self.G} 個群組")

    # ---------- 基本操作 ----------
    def members(self, name):
        """某個群組裡所有神經元的索引"""
        return np.where(self.group == self.name2id[name])[0]

    def stimulate(self, name, intensity=None):
        """對某一組神經元加電壓（相當於瀏覽器版按下「餵食」之類的刺激）"""
        idx = self.members(name)
        self.V[idx] += self.STIM if intensity is None else intensity

    def spikes(self, name):
        """上一格裡，某一組神經元放電了幾次"""
        return int(self.last_spikes[self.name2id[name]])

    def reset(self):
        self.V[:] = 0
        self.fired[:] = False
        self.refr[:] = 0
        self.reward = self.punish = 0.0

    # ---------- 一格模擬（0.1 秒）----------
    def tick(self, reward=0.0, punish=0.0):
        # 1. 漏電 + 不反應期
        in_refr = self.refr > 0
        self.refr[in_refr] -= 1
        self.V[in_refr] = 0
        self.V[~in_refr] *= self.LEAK

        # 2. 放電的神經元把訊號沿突觸送到下游
        if self.fired.any():
            self.V += self.Wt @ self.fired.astype(np.float32)
            if self.plastic:
                # 這些可塑突觸的「前」神經元剛放電 → 標記為活躍
                self.trace[self.fired[self._p_pre]] = 1.0

        # 3. 超過門檻就放電
        new = (self.refr == 0) & (self.V >= self.THRESHOLD)
        if self.kc_sparsity:
            # 稀疏編碼（APL 抑制）：KC 裡只有電壓最高的前 k 顆可以放電
            kc = self._kc_idx
            cand = kc[new[kc]]
            k = int(len(kc) * self.kc_sparsity)
            if len(cand) > k:
                drop = cand[np.argsort(self.V[cand])[:-k]]
                new[drop] = False
                self.V[drop] *= 0.5          # 被壓下去的電壓打對折，下一格還有機會
        self.V[new] = 0
        self.refr[new] = self.REFRACTORY
        self.fired = new
        self.last_spikes = np.bincount(self.group[new], minlength=self.G)

        # 4. 突觸可塑性（呼叫你寫的 learning_rule）
        self.reward = max(self.reward * self.DOPA_DECAY, float(reward))
        self.punish = max(self.punish * self.DOPA_DECAY, float(punish))
        if self.reward < 0.01: self.reward = 0.0
        if self.punish < 0.01: self.punish = 0.0
        if self.plastic and self.learning and self.rule is not None and self.rule_error is None:
            self._apply_rule()
        if self.plastic:
            self.trace *= self.TRACE_DECAY

        self.tick_count += 1

    # ---------- 可塑性 ----------
    def set_plastic(self, pre_name, post_name):
        """指定哪一批突觸可以學習，例如 ('MB_KC', 'MB_MBON_APP')"""
        pre, post = self.name2id[pre_name], self.name2id[post_name]
        mask = (self.group[self._cols] == pre) & (self.group[self._rows] == post)
        self._p_idx = np.where(mask)[0]                 # 這些突觸在 Wt.data 裡的位置
        self._p_pre = self._cols[self._p_idx]           # 每條可塑突觸的前神經元
        self._p_orig = self.Wt.data[self._p_idx].copy() # 原始權重
        self.strength = np.ones(len(self._p_idx), np.float32)   # 倍率，1.0 = 原本
        self.trace = np.zeros(len(self._p_idx), np.float32)
        self.plastic = True
        print(f"可塑突觸：{pre_name} → {post_name}，共 {len(self._p_idx):,} 條")

    def load_rule(self, module_name="learning_rule"):
        """讀取（或重新讀取）learning_rule.py"""
        try:
            mod = importlib.import_module(module_name)
            mod = importlib.reload(mod)
            self.rule = getattr(mod, "learning_rule")
            self.rule_error = None
            print("學習規則已載入")
        except Exception as e:
            self.rule = None
            self.rule_error = f"{type(e).__name__}: {e}"
            print("✗ 學習規則載入失敗：", self.rule_error)

    def _apply_rule(self):
        try:
            ns = self.rule(self.strength, self.trace, self.reward, self.punish)
            ns = np.asarray(ns, dtype=np.float32)
            if ns.shape == ():                       # 回傳單一數字也接受
                ns = np.full_like(self.strength, float(ns))
            if ns.shape != self.strength.shape:
                raise ValueError(f"回傳的形狀是 {ns.shape}，應該是 {self.strength.shape}")
            if not np.all(np.isfinite(ns)):
                raise ValueError("回傳裡有 NaN 或無限大")
        except Exception as e:
            self.rule_error = f"{type(e).__name__}: {e}"
            print("\n✗ learning_rule 執行出錯，學習已暫停：", self.rule_error)
            return
        np.clip(ns, self.STRENGTH_MIN, self.STRENGTH_MAX, out=ns)
        self.strength = ns
        self.Wt.data[self._p_idx] = self._p_orig * ns

    def reset_memory(self):
        if self.plastic:
            self.strength[:] = 1.0
            self.trace[:] = 0.0
            self.Wt.data[self._p_idx] = self._p_orig
        self.reward = self.punish = 0.0

    def avg_strength(self):
        return float(self.strength.mean()) if self.plastic else 1.0
