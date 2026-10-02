# -*- coding: utf-8 -*-
"""
learning_rule.py —— 這個檔案是你的。

蒼蠅腦裡有 21,438 條「氣味 → 想靠近」的突觸（KC → MBON_APP）。
每一格模擬時間（0.1 秒）都會呼叫這個函式一次，你回傳的就是每條突觸的新強度。

參數：
    strength  每條突觸現在的強度。1.0 = 原本，2.0 = 兩倍，0 = 斷線
    trace     每條突觸最近有多活躍。1 = 剛剛才用到，0 = 很久沒動，中間慢慢衰減
    reward    現在有沒有獎勵（多巴胺）。0 = 沒有，1 = 剛給，中間慢慢衰減
    punish    現在有沒有懲罰。同上

重要：strength 和 trace 不是一個數字，而是「一整排 21,438 個數字」（numpy 陣列），
       全部同時計算。所以：
         ✓ 直接加減乘除：  strength + 0.02 * reward * trace
         ✓ 對 reward / punish 用 if（它們是單一數字）
         ✗ 不要寫 if trace > 0（一整排數字不能直接判斷真假）
       想做「只有活躍的才變」，把 trace 乘進去就好，不活躍的 trace 是 0，乘了等於沒變。

改完存檔，重新執行 train.py 就會用新的規則。
"""


def learning_rule(strength, trace, reward, punish):

    # 目前：什麼都不做，原封不動回傳 —— 所以牠學不會任何事。
    # 從這裡開始改。

    return strength
