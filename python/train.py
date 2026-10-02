# -*- coding: utf-8 -*-
"""
train.py —— 訓練實驗：教蒼蠅「這個氣味 = 有好事」。

用法：
    python3 train.py                 預設：測基準 → 每訓練 2 次測一次，共 10 次獎勵訓練
    python3 train.py --trials 20     訓練 20 次
    python3 train.py --punish        後半段改成懲罰，看牠會不會「忘記」甚至變得討厭
    python3 train.py --no-plot       不畫圖

流程跟瀏覽器版訓練場一模一樣：
    一次訓練 = 氣味 1.5 秒（15 格）＋ 休息 1.2 秒（12 格）
    一次測試 = 只給氣味，數 2.5 秒內「想靠近」神經元（MB_MBON_APP）放電幾次
"""
import argparse
import sys
import time

from flybrain import FlyBrain

ODOR = "OLF_ORN_FOOD"      # 氣味
SUGAR = "GUS_GRN_SWEET"    # 糖水的味覺
DOPA = "MB_DAN_REW"        # 多巴胺獎勵神經元
READOUT = "MB_MBON_APP"    # 「想靠近」

TRIAL_TICKS, GAP_TICKS, TEST_TICKS = 15, 12, 25


def trial(brain, kind):
    """kind: 'odor' 只給氣味 / 'reward' 氣味＋糖水 / 'punish' 氣味＋電擊"""
    for _ in range(TRIAL_TICKS):
        brain.stimulate(ODOR)
        if kind == "reward":
            brain.stimulate(SUGAR)
            brain.stimulate(DOPA)
            brain.tick(reward=1.0)
        elif kind == "punish":
            brain.tick(punish=1.0)
        else:
            brain.tick()
    for _ in range(GAP_TICKS):
        brain.tick()


def test(brain):
    """只給氣味，回傳「想靠近」神經元的總放電數。
    測試前先把電壓歸零（記憶存在突觸強度裡，不在電壓裡），
    這樣每次測試的起跑條件一樣，才不會被上一次訓練的殘留干擾。"""
    brain.reset()
    for _ in range(10):
        brain.tick()
    total = 0
    for t in range(TEST_TICKS):
        if t < TRIAL_TICKS:
            brain.stimulate(ODOR)
        brain.tick()
        total += brain.spikes(READOUT)
    for _ in range(GAP_TICKS):
        brain.tick()
    return total


def bar(ratio, width=30):
    n = int(min(ratio, 3.0) / 3.0 * width)
    return "█" * n + "·" * (width - n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trials", type=int, default=10, help="訓練幾次（預設 10）")
    ap.add_argument("--every", type=int, default=2, help="每訓練幾次測一次（預設 2）")
    ap.add_argument("--punish", action="store_true", help="後半段改成懲罰")
    ap.add_argument("--no-plot", action="store_true")
    args = ap.parse_args()

    brain = FlyBrain()
    brain.set_plastic("MB_KC", READOUT)
    brain.load_rule()
    if brain.rule_error:
        print("先把 learning_rule.py 修好再跑。")
        sys.exit(1)

    for _ in range(30):
        brain.tick()

    t0 = time.time()
    baseline = max(test(brain), 1)
    print(f"基準（還沒訓練）：氣味 → 想靠近 {baseline} 次放電\n")
    print(f"{'訓練次數':>6}  {'放電':>6}  {'倍率':>6}  {'平均強度':>8}  圖")
    print(f"{'0':>6}  {baseline:>6}  {'1.00':>6}  {brain.avg_strength():>8.3f}  {bar(1.0)}")

    history = [(0, baseline, 1.0, brain.avg_strength())]
    half = args.trials // 2
    for i in range(1, args.trials + 1):
        kind = "punish" if (args.punish and i > half) else "reward"
        trial(brain, kind)
        if i % args.every == 0 or i == args.trials:
            n = test(brain)
            ratio = n / baseline
            history.append((i, n, ratio, brain.avg_strength()))
            tag = " ⚡" if kind == "punish" else " 🍬"
            print(f"{i:>6}  {n:>6}  {ratio:>6.2f}  {brain.avg_strength():>8.3f}  {bar(ratio)}{tag}")
            if brain.rule_error:
                break

    dt = time.time() - t0
    print(f"\n跑了 {brain.tick_count} 格模擬（= {brain.tick_count/10:.0f} 秒的蒼蠅時間），實際花 {dt:.1f} 秒")

    final = history[-1][2]
    if brain.rule_error:
        print("\n規則出錯了，看上面的錯誤訊息。")
    elif abs(final - 1.0) < 0.15:
        print("\n結論：牠沒學會。反應跟訓練前差不多 —— 去改 learning_rule.py。")
    elif final > 1.15:
        print(f"\n結論：牠學會了！同樣的氣味，現在「想靠近」的反應是原本的 {final:.2f} 倍。")
    else:
        print(f"\n結論：牠變得比較不想靠近了（{final:.2f} 倍）。")

    if not args.no_plot:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            plt.rcParams["font.family"] = ["PingFang TC", "Heiti TC", "Arial Unicode MS", "sans-serif"]
            xs = [h[0] for h in history]
            fig, ax1 = plt.subplots(figsize=(7, 4))
            ax1.plot(xs, [h[2] for h in history], "o-", color="#8b5cf6", lw=2, label="反應倍率")
            ax1.axhline(1.0, color="gray", ls="--", lw=1)
            ax1.set_xlabel("訓練次數")
            ax1.set_ylabel("「想靠近」反應（訓練前 = 1.0）")
            ax2 = ax1.twinx()
            ax2.plot(xs, [h[3] for h in history], "s--", color="#f59e0b", alpha=.7, label="平均突觸強度")
            ax2.set_ylabel("平均突觸強度")
            ax1.set_title("果蠅氣味學習曲線")
            fig.legend(loc="upper left", bbox_to_anchor=(0.12, 0.88))
            fig.tight_layout()
            out = "學習曲線.png"
            fig.savefig(out, dpi=130)
            print(f"圖已存成 {out}")
        except Exception as e:
            print("（畫圖略過：", e, "）")


if __name__ == "__main__":
    main()
