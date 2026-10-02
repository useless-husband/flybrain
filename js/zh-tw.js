/* 繁體中文化補丁 — 只改「顯示出來的文字」，不動任何程式邏輯。
 * 行為狀態、隱藏/顯示按鈕等文字是 JS 即時產生的，所以在這裡攔截翻譯。 */
(function () {
	'use strict';

	// 行為狀態（#behaviorState 的內容由 behavior.current 即時決定）
	var STATE_ZH = {
		'idle': '發呆中',
		'walk': '走路中',
		'walking': '走路中',
		'rest': '休息中',
		'resting': '休息中',
		'feed': '進食中',
		'feeding': '進食中',
		'eat': '進食中',
		'eating': '進食中',
		'groom': '理毛中',
		'grooming': '理毛中',
		'startle': '受驚嚇！',
		'startled': '受驚嚇！',
		'fly': '飛行中',
		'flying': '飛行中',
		'flight': '飛行中',
		'flee': '逃跑中',
		'fleeing': '逃跑中',
		'escape': '逃跑中',
		'seek': '搜尋食物',
		'seeking': '搜尋食物',
		'explore': '四處探索',
		'exploring': '四處探索',
		'phototaxis': '趨光移動',
		'turn': '轉向中',
		'turning': '轉向中',
		'backup': '倒退中',
		'sleep': '睡覺中',
		'sleeping': '睡覺中'
	};

	// 通用的零星按鈕文字
	var UI_ZH = {
		'Hide': '隱藏',
		'Show': '顯示',
		'Send': '送出',
		'Sensory': '感覺輸入',
		'Central': '中樞處理',
		'Drives': '內在驅力',
		'Motor': '運動輸出'
	};

	function translateNode(el) {
		if (!el || el.children.length) return;
		var t = (el.textContent || '').trim();
		if (!t) return;
		var zh = STATE_ZH[t] || STATE_ZH[t.toLowerCase()] || UI_ZH[t];
		if (zh && zh !== t) el.textContent = zh;
	}

	function sweep() {
		translateNode(document.getElementById('behaviorState'));
		['connectomeToggleBtn', 'analytics-toggle', 'calendar-toggle', 'chat-send-btn']
			.forEach(function (id) { translateNode(document.getElementById(id)); });
	}

	function start() {
		// 讓「大腦導覽」裡的原文學名有個低調的樣式，方便對照查資料
		var style = document.createElement('style');
		style.textContent =
			'.edu-orig-name{margin:.1rem 0 .6rem;font-size:.75rem;opacity:.45;' +
			'letter-spacing:.02em;font-style:italic;}';
		document.head.appendChild(style);

		sweep();
		// 這些文字會隨模擬即時改變，所以持續盯著
		var obs = new MutationObserver(sweep);
		obs.observe(document.body, { childList: true, characterData: true, subtree: true });
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
