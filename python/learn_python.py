# -*- coding: utf-8 -*-
"""
learn_python.py —— 讓果蠅腦「學 Python」。

牠學東西只有一種方式：某個感覺 → 好／壞。所以我們把 Python 的字當成氣味餵牠：
    每個「字母＋位置」對應一小群嗅覺神經元（像真實氣味是多種分子的混合）
    合法的 Python 關鍵字（def、for、while…）→ 給糖（多巴胺獎勵）
    亂碼（fed、rof、elihw…）→ 給電擊（懲罰）
然後測：只給牠「聞」一個字，看「想靠近」神經元放電多少。
如果牠學會了，關鍵字的反應會高、亂碼的反應會低 —— 牠就是用這種方式「認得 Python」。

用法：
    python3 learn_python.py                       用你的 learning_rule.py
    python3 learn_python.py --rule learning_rule_參考解答
    python3 learn_python.py --epochs 8 --ask prnt whlie   訓練後再考牠沒看過的字
"""
import argparse
import hashlib

import numpy as np

from flybrain import FlyBrain

KEYWORDS = ["def", "for", "while", "if", "else", "return", "import", "class", "print", "lambda"]
NONWORDS = ["fed", "rof", "elihw", "fi", "esle", "nruter", "tropmi", "ssalc", "tnirp", "adbmal"]
READOUT = "MB_MBON_APP"
PRESENT_TICKS, SETTLE_TICKS = 15, 10


class Nose:
    """把一個字轉成一組嗅覺神經元（同一個字每次都一樣，不同字不一樣）"""
    def __init__(self, brain, frac):
        self.orn = brain.members("OLF_ORN_FOOD")
        self.frac = frac
        self.cache = {}

    def encode(self, token):
        if token in self.cache:
            return self.cache[token]
        per = max(20, int(len(self.orn) * self.frac / len(token)))
        parts = []
        for i, ch in enumerate(token):
            seed = int(hashlib.md5(f"{ch}@{i}".encode()).hexdigest(), 16) % 2**32
            rng = np.random.default_rng(seed)
            parts.append(rng.choice(self.orn, per, replace=False))
        idx = np.unique(np.concatenate(parts))
        self.cache[token] = idx
        return idx


def present(brain, nose, token, intensity, reward=0.0, punish=0.0):
    """讓牠聞一個字。回傳「想靠近」神經元收到的總突觸訊號（像用電極量膜電位）。
    放電數也一起回傳（brain.last_readout_spikes），但稀疏編碼下通常很少。"""
    brain.reset()
    for _ in range(10):
        brain.tick()
    idx = nose.encode(token)
    app = brain.members(READOUT)
    drive, spikes = 0.0, 0
    for t in range(PRESENT_TICKS + SETTLE_TICKS):
        if t < PRESENT_TICKS:
            brain.V[idx] += intensity
            brain.tick(reward=reward, punish=punish)
        else:
            brain.tick()
        if brain.fired.any():
            drive += float((brain.Wt[app] @ brain.fired.astype(np.float32)).sum())
        spikes += brain.spikes(READOUT)
    brain.last_readout_spikes = spikes
    return round(drive, 2)


def exam(brain, nose, intensity, words):
    """考試：測驗期間凍住可塑性（不算學習時間，也不會忘）"""
    brain.learning = False
    try:
        return {w: present(brain, nose, w, intensity) for w in words}
    finally:
        brain.learning = True


def auc(good, bad):
    """關鍵字分數高過亂碼的比例（0.5 = 亂猜，1.0 = 完美分辨）"""
    pairs = [(g, b) for g in good for b in bad]
    return sum(1.0 if g > b else 0.5 if g == b else 0.0 for g, b in pairs) / len(pairs)


def bar(v, vmax, width=22):
    n = int(round(v / max(vmax, 1) * width))
    return "█" * n + "·" * (width - n)


def show_table(scores, vmax, before=None):
    def delta(w):
        if before is None:
            return ""
        d = scores[w] - before[w]
        return f" {'↑' if d > 0.05 else '↓' if d < -0.05 else '＝'}{d:+.1f}"
    print(f"    {'Python 關鍵字':<14}{'反應':>6}{'':7}   {'亂碼':<14}{'反應':>6}")
    for k, n in zip(KEYWORDS, NONWORDS):
        print(f"    {k:<8}{bar(scores[k], vmax)} {scores[k]:>5.1f}{delta(k):<7}   {n:<8}{bar(scores[n], vmax)} {scores[n]:>5.1f}{delta(n)}")
    if before is not None:
        up = sum(1 for k in KEYWORDS if scores[k] > before[k] + 0.05)
        dn = sum(1 for n in NONWORDS if scores[n] < before[n] - 0.05)
        print(f"    跟訓練前比：{up}/{len(KEYWORDS)} 個關鍵字反應上升，{dn}/{len(NONWORDS)} 個亂碼反應下降")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=10, help="每個字各訓練幾輪（預設 10）")
    ap.add_argument("--rule", default="learning_rule", help="規則檔的模組名（預設 learning_rule）")
    ap.add_argument("--frac", type=float, default=0.8, help="一個字動用多少比例的嗅覺神經元")
    ap.add_argument("--intensity", type=float, default=0.3)
    ap.add_argument("--sparsity", type=float, default=0.01, help="KC 稀疏編碼：每格只讓這個比例的 KC 放電（0 = 關閉）")
    ap.add_argument("--dopamine", type=float, default=5.0, help="獎勵／懲罰的強度（糖多甜、電多痛）")
    ap.add_argument("--ask", nargs="*", default=[], help="訓練後考牠沒看過的字")
    ap.add_argument("--no-plot", action="store_true")
    args = ap.parse_args()

    brain = FlyBrain(kc_sparsity=args.sparsity or None)
    brain.set_plastic("MB_KC", READOUT)
    brain.load_rule(args.rule)
    if brain.rule_error:
        return
    nose = Nose(brain, args.frac)
    words = KEYWORDS + NONWORDS

    print("\n【訓練前】牠對每個字的反應：")
    s0 = exam(brain, nose, args.intensity, words)
    vmax = max(max(s0.values()), 1)
    show_table(s0, vmax)
    g0 = np.mean([s0[k] for k in KEYWORDS]); b0 = np.mean([s0[n] for n in NONWORDS])
    print(f"    關鍵字平均 {g0:.1f}  亂碼平均 {b0:.1f}  分辨力 {auc([s0[k] for k in KEYWORDS], [s0[n] for n in NONWORDS]):.2f}（0.5 = 亂猜）")

    history = [(0, g0, b0, auc([s0[k] for k in KEYWORDS], [s0[n] for n in NONWORDS]))]
    rng = np.random.default_rng(0)
    print(f"\n【訓練】關鍵字給糖 🍬、亂碼給電擊 ⚡，共 {args.epochs} 輪 × {len(words)} 個字")
    print(f"  {'輪':>3}  {'關鍵字平均':>8}  {'亂碼平均':>8}  {'分辨力':>6}  {'平均強度':>8}")
    for ep in range(1, args.epochs + 1):
        order = list(words); rng.shuffle(order)
        for w in order:
            if w in KEYWORDS:
                present(brain, nose, w, args.intensity, reward=args.dopamine)
            else:
                present(brain, nose, w, args.intensity, punish=args.dopamine)
        if brain.rule_error:
            break
        s = exam(brain, nose, args.intensity, words)
        g = np.mean([s[k] for k in KEYWORDS]); b = np.mean([s[n] for n in NONWORDS])
        a = auc([s[k] for k in KEYWORDS], [s[n] for n in NONWORDS])
        history.append((ep, g, b, a))
        print(f"  {ep:>3}  {g:>8.1f}  {b:>8.1f}  {a:>6.2f}  {brain.avg_strength():>8.3f}")

    print("\n【訓練後】牠對每個字的反應：")
    s1 = exam(brain, nose, args.intensity, words)
    vmax = max(max(s1.values()), max(s0.values()), 1)
    show_table(s1, vmax, before=s0)
    g1 = np.mean([s1[k] for k in KEYWORDS]); b1 = np.mean([s1[n] for n in NONWORDS])
    a1 = auc([s1[k] for k in KEYWORDS], [s1[n] for n in NONWORDS])
    print(f"    關鍵字平均 {g1:.1f}  亂碼平均 {b1:.1f}  分辨力 {a1:.2f}")

    if a1 >= 0.9:
        print("\n結論：牠學會了。給牠一個字，牠幾乎都能「聞」出是不是 Python。")
    elif a1 >= 0.7:
        print("\n結論：牠學到一半。分得出大部分，但還會搞混。多訓練幾輪試試（--epochs 10）。")
    elif abs(a1 - 0.5) < 0.1 and brain.avg_strength() == 1.0:
        print("\n結論：牠什麼都沒學到 —— 規則檔什麼都沒做。去改 learning_rule.py。")
    else:
        print("\n結論：分辨力沒有明顯上升。改改學習速度，或用 --frac 調整編碼。")

    if args.ask:
        print("\n【考試】牠沒看過的字：")
        sa = exam(brain, nose, args.intensity, args.ask)
        mid = (g1 + b1) / 2
        for w, v in sa.items():
            verdict = "像 Python 🐍" if v > mid else "像亂碼 ✗"
            print(f"    {w:<10} 反應 {v:>5.1f}  → 牠覺得：{verdict}")

    if not args.no_plot:
        try:
            import matplotlib; matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            plt.rcParams["font.family"] = ["PingFang TC", "Heiti TC", "Arial Unicode MS", "sans-serif"]
            xs = [h[0] for h in history]
            fig, ax = plt.subplots(figsize=(7, 4))
            ax.plot(xs, [h[1] for h in history], "o-", color="#22c55e", lw=2, label="Python 關鍵字（給糖）")
            ax.plot(xs, [h[2] for h in history], "s-", color="#ef4444", lw=2, label="亂碼（給電擊）")
            ax.set_xlabel("訓練輪數"); ax.set_ylabel("「想靠近」神經元收到的訊號")
            ax2 = ax.twinx(); ax2.plot(xs, [h[3] for h in history], "^--", color="#8b5cf6", alpha=.8, label="分辨力")
            ax2.set_ylim(0.4, 1.02); ax2.set_ylabel("分辨力（1.0 = 完美）")
            ax.set_title("果蠅腦學 Python：關鍵字 vs 亂碼"); fig.legend(loc="upper left", bbox_to_anchor=(0.1, 0.9))
            fig.tight_layout(); fig.savefig("學Python曲線.png", dpi=130); print("\n圖已存成 學Python曲線.png")
        except Exception as e:
            print("（畫圖略過：", e, "）")


if __name__ == "__main__":
    main()
