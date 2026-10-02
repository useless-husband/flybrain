# -*- coding: utf-8 -*-
"""參考解答 —— 卡住再看。要用的話把 learning_rule 整段複製到 learning_rule.py。"""


def learning_rule(strength, trace, reward, punish):
    學習速度 = 0.02
    遺忘速度 = 0.0005

    # 關卡 2：有獎勵、而且這條線剛好在用（trace 大）→ 變強
    strength = strength + 學習速度 * reward * trace

    # 關卡 3：有懲罰 → 變弱
    strength = strength - 學習速度 * punish * trace

    # 關卡 4：沒事的時候慢慢往 1.0 漂回去（遺忘）
    strength = strength + (1.0 - strength) * 遺忘速度

    return strength
