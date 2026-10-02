/* 參考解答 —— 卡住再看。這個檔案不會被載入，只是給你對照用。
 * 想用它：把整段 learningRule 複製到 learning-rule.js 蓋掉原本的。 */

function learningRule(s) {
	var 學習速度 = 0.02;
	var 遺忘速度 = 0.0005;

	// 關卡 2：獎勵 × 這條線剛好在用 → 變強（赫布法則 + 多巴胺門控）
	if (s.reward > 0 && s.trace > 0) {
		s.strength = s.strength + 學習速度 * s.reward * s.trace;
	}

	// 關卡 3：懲罰 × 這條線剛好在用 → 變弱
	if (s.punish > 0 && s.trace > 0) {
		s.strength = s.strength - 學習速度 * s.punish * s.trace;
	}

	// 關卡 4：沒事的時候慢慢忘掉，往 1.0 漂回去
	s.strength = s.strength + (1.0 - s.strength) * 遺忘速度;

	return s.strength;
}
