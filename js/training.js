/* 訓練場 —— 讓蒼蠅學會「這個氣味 = 有好事」的實驗台。
 * 這裡只負責：對腦下刺激、注入多巴胺、量反應、把數字畫出來。
 * 真正決定牠會不會學的，是 learning-rule.js 裡你寫的規則。 */
(function () {
	'use strict';

	var ODOR = 'OLF_ORN_FOOD';        // 氣味走這一組進去
	var SUGAR = 'GUS_GRN_SWEET';      // 糖水的味覺
	var DOPA_REW = 'MB_DAN_REW';      // 多巴胺獎勵神經元（直接點亮 = 光遺傳學）
	var READOUT = 'MB_MBON_APP';      // 量「想靠近」有多強
	var READOUT2 = 'SEZ_FEED';        // 量「進食指令」有多強
	var INTENSITY = 0.15;             // 跟主程式 STIM_INTENSITY 一樣
	var TRIAL_TICKS = 15;             // 一次刺激持續 1.5 秒
	var TEST_TICKS = 25;              // 測試時觀察 2.5 秒
	var GAP_MS = 1200;                // 兩次之間休息

	var panel, els = {}, busy = false, open = false;
	var readoutId = -1, readout2Id = -1;
	var testing = false, testApp = 0, testFeed = 0, testTicksLeft = 0, testDone = null;
	var baseline = null, history = [], trials = {odor: 0, reward: 0, punish: 0};
	var pollTimer = null;

	/* ---------- 樣式 ---------- */
	var css = '\
#training-panel{position:fixed;top:44px;right:0;bottom:0;width:400px;max-width:92vw;background:var(--surface,#16181d);border-left:1px solid var(--border,#2a2d35);z-index:26;display:none;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;color:#e6e8ee;box-shadow:0 1px 3px rgba(0,0,0,.3)}\
#training-panel.open{display:flex}\
.tr-head{display:flex;align-items:center;justify-content:space-between;padding:.6rem .9rem;border-bottom:1px solid var(--border,#2a2d35);font-weight:600}\
.tr-close{background:none;border:none;color:#aaa;font-size:1.4rem;cursor:pointer;line-height:1}\
.tr-body{overflow-y:auto;padding:.8rem .9rem 2rem;flex:1;font-size:.86rem;line-height:1.5}\
.tr-sec{margin-bottom:1.1rem;padding:.7rem .8rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px}\
.tr-sec h3{margin:0 0 .5rem;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:#9aa3b5}\
.tr-row{display:flex;gap:.4rem;flex-wrap:wrap;margin:.35rem 0}\
.tr-btn{flex:1 1 auto;min-width:0;padding:.45rem .6rem;border-radius:6px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e6e8ee;cursor:pointer;font-size:.84rem}\
.tr-btn:hover{background:rgba(255,255,255,.12)}.tr-btn:disabled{opacity:.4;cursor:default}\
.tr-btn.rew{border-color:#22c55e88}.tr-btn.pun{border-color:#ef444488}.tr-btn.test{border-color:#3b82f688;font-weight:600}\
.tr-kv{display:flex;justify-content:space-between;padding:.15rem 0;color:#c7cbd6}.tr-kv b{color:#fff;font-variant-numeric:tabular-nums}\
.tr-bar{height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;margin:.25rem 0 .5rem}\
.tr-bar>i{display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#8b5cf6);width:0;transition:width .3s}\
.tr-status{padding:.4rem .6rem;border-radius:6px;font-size:.8rem;margin-bottom:.4rem}\
.tr-status.ok{background:#22c55e22;color:#86efac}.tr-status.err{background:#ef444422;color:#fca5a5;white-space:pre-wrap;word-break:break-all}.tr-status.wait{background:#f59e0b22;color:#fcd34d}\
.tr-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#333;margin-right:.35rem;vertical-align:middle;transition:background .15s}\
.tr-dot.on{background:#22c55e;box-shadow:0 0 8px #22c55e}.tr-dot.pun.on{background:#ef4444;box-shadow:0 0 8px #ef4444}\
.tr-result{font-size:1.5rem;font-weight:700;text-align:center;margin:.3rem 0}\
.tr-result small{display:block;font-size:.75rem;font-weight:400;color:#9aa3b5}\
.tr-hist{font-size:.78rem;color:#aab;max-height:120px;overflow-y:auto;font-variant-numeric:tabular-nums}\
.tr-hist div{display:flex;justify-content:space-between;padding:.1rem 0;border-bottom:1px dashed rgba(255,255,255,.06)}\
canvas.tr-chart{width:100%;height:70px;display:block;margin:.4rem 0;background:rgba(0,0,0,.2);border-radius:4px}\
.tr-task{margin:.4rem 0;padding:.45rem .6rem;border-left:3px solid #3b82f6;background:rgba(59,130,246,.06);border-radius:0 6px 6px 0}\
.tr-task b{color:#fff}.tr-task code{background:rgba(0,0,0,.35);padding:.05rem .3rem;border-radius:3px;font-size:.8rem}\
.tr-path{font-family:ui-monospace,Menlo,monospace;font-size:.75rem;background:rgba(0,0,0,.35);padding:.4rem .5rem;border-radius:4px;word-break:break-all;color:#cbd5e1}\
.tr-log{color:#9aa3b5;font-size:.78rem;min-height:1.2em}\
details.tr-details>summary{cursor:pointer;color:#9aa3b5;font-size:.8rem;margin:.2rem 0 .4rem}';
	var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

	/* ---------- 面板 ---------- */
	function h(tag, attrs, children) {
		var el = document.createElement(tag);
		if (attrs) for (var k in attrs) { if (k === 'text') el.textContent = attrs[k]; else if (k === 'html') el.innerHTML = attrs[k]; else el.setAttribute(k, attrs[k]); }
		(children || []).forEach(function (c) { el.appendChild(c); });
		return el;
	}
	function btn(label, cls, onClick, id) {
		var b = h('button', {'class': 'tr-btn ' + (cls || ''), text: label});
		b.addEventListener('click', onClick);
		if (id) els[id] = b;
		return b;
	}

	function buildPanel() {
		panel = h('div', {id: 'training-panel'});
		var close = h('button', {'class': 'tr-close', html: '&times;'});
		close.addEventListener('click', hide);
		panel.appendChild(h('div', {'class': 'tr-head'}, [h('span', {text: '訓練場 — 教牠「這個氣味 = 有好事」'}), close]));
		var body = h('div', {'class': 'tr-body'});
		panel.appendChild(body);

		// 狀態
		els.ruleStatus = h('div', {'class': 'tr-status wait', text: '等待大腦載入…'});
		els.count = h('b', {text: '—'});
		els.avg = h('b', {text: '—'});
		els.range = h('b', {text: '—'});
		els.active = h('b', {text: '—'});
		els.avgBar = h('i');
		els.dotR = h('span', {'class': 'tr-dot'});
		els.dotP = h('span', {'class': 'tr-dot pun'});
		body.appendChild(h('div', {'class': 'tr-sec'}, [
			h('h3', {text: '學習規則狀態'}),
			els.ruleStatus,
			h('div', {'class': 'tr-kv'}, [h('span', {text: '可以學習的突觸'}), els.count]),
			h('div', {'class': 'tr-kv'}, [h('span', {text: '平均強度（1.00 = 原本）'}), els.avg]),
			h('div', {'class': 'tr-bar'}, [els.avgBar]),
			h('div', {'class': 'tr-kv'}, [h('span', {text: '最弱 ～ 最強'}), els.range]),
			h('div', {'class': 'tr-kv'}, [h('span', {text: '正在活躍的突觸'}), els.active]),
			h('div', {'class': 'tr-kv'}, [h('span', {html: '多巴胺訊號'}), h('span', {}, [els.dotR, h('span', {text: '獎勵 '}), els.dotP, h('span', {text: '懲罰'})])])
		]));

		// 訓練
		els.log = h('div', {'class': 'tr-log'});
		els.trialCount = h('b', {text: '0 / 0 / 0'});
		body.appendChild(h('div', {'class': 'tr-sec'}, [
			h('h3', {text: '訓練'}),
			h('div', {'class': 'tr-row'}, [
				btn('只給氣味', '', function () { runTrial('odor'); }, 'bOdor'),
				btn('氣味 ＋ 糖水 🍬', 'rew', function () { runTrial('reward'); }, 'bRew'),
				btn('氣味 ＋ 電擊 ⚡', 'pun', function () { runTrial('punish'); }, 'bPun')
			]),
			h('div', {'class': 'tr-row'}, [
				btn('🍬 連續 10 次', 'rew', function () { runMany('reward', 10); }, 'bRew10'),
				btn('⚡ 連續 10 次', 'pun', function () { runMany('punish', 10); }, 'bPun10')
			]),
			h('div', {'class': 'tr-kv'}, [h('span', {text: '次數（氣味 / 獎勵 / 懲罰）'}), els.trialCount]),
			els.log
		]));

		// 測試
		els.result = h('div', {'class': 'tr-result', html: '—<small>還沒測過</small>'});
		els.chart = h('canvas', {'class': 'tr-chart'});
		els.hist = h('div', {'class': 'tr-hist'});
		body.appendChild(h('div', {'class': 'tr-sec'}, [
			h('h3', {text: '測試：只給氣味，看牠多想靠近'}),
			h('div', {'class': 'tr-row'}, [btn('▶ 測試反應', 'test', runTest, 'bTest')]),
			els.result,
			els.chart,
			els.hist
		]));

		// 工具
		els.learnToggle = btn('學習：開', '', toggleLearning, 'bLearn');
		body.appendChild(h('div', {'class': 'tr-sec'}, [
			h('h3', {text: '工具'}),
			h('div', {'class': 'tr-row'}, [
				btn('↻ 重新載入規則', '', reloadRule, 'bReload'),
				btn('🧹 清除記憶', '', resetMemory, 'bReset'),
				els.learnToggle
			]),
			h('div', {'class': 'tr-kv', style: 'margin-top:.4rem'}, [h('span', {text: '你的規則檔在：'})]),
			h('div', {'class': 'tr-path', text: '~/Desktop/FlyBrain/js/learning-rule.js'}),
			h('div', {'class': 'tr-kv', style: 'margin-top:.3rem;color:#9aa3b5;font-size:.78rem'}, [h('span', {text: '打開方式：連點桌面 FlyBrain 資料夾裡的「開啟規則檔.command」'})])
		]));

		// 關卡
		var tasks = h('details', {'class': 'tr-details', open: ''}, [
			h('summary', {text: '關卡（照順序做）'}),
			h('div', {'class': 'tr-task', html: '<b>關卡 1：證明牠學不會。</b><br>先按「測試反應」記下數字 → 按「🍬 連續 10 次」→ 再測一次。數字幾乎沒變，因為規則檔現在什麼都沒做。'}),
			h('div', {'class': 'tr-task', html: '<b>關卡 2：讓牠學會。</b><br>打開規則檔，在 <code>return</code> 前面加：有獎勵、而且這條線剛好在用的時候，把強度加一點點。提示：<code>s.reward</code>、<code>s.trace</code>、<code>s.strength</code> 三個都要用到。存檔 → 按「重新載入規則」→ 🍬 訓練 10 次 → 測試。'}),
			h('div', {'class': 'tr-task', html: '<b>關卡 3：讓牠也會怕。</b><br>有懲罰的時候，把強度減一點。做完試試「⚡ 連續 10 次」，反應應該掉下去。'}),
			h('div', {'class': 'tr-task', html: '<b>關卡 4：讓牠會忘。</b><br>現在學會就永遠記得，真的腦不是這樣。加一行讓強度每一格都往 1.0 靠近一點點（很小，例如 0.0005）。'}),
			h('div', {'class': 'tr-task', html: '<b>關卡 5：把它玩壞。</b><br>把學習速度改成 0.5，看會發生什麼事。再改成負的呢？想想為什麼真的腦不能這樣。'}),
			h('div', {'class': 'tr-task', style: 'border-color:#f59e0b', html: '卡住了看 <code>learning-rule.參考解答.js</code>，或直接問我。'})
		]);
		body.appendChild(h('div', {'class': 'tr-sec'}, [tasks]));

		document.body.appendChild(panel);
	}

	/* ---------- 跟 worker 溝通 ---------- */
	function post(msg) { if (BRAIN.workerPost) BRAIN.workerPost(msg); }
	function stim(name) { return BRAIN.stimulateGroup && BRAIN.stimulateGroup(name, INTENSITY); }

	function onWorker(d) {
		if (d.type === 'ready' || d.type === 'plasticityReady') {
			var m = BRAIN.workerGroupNameToId || {};
			readoutId = m[READOUT] !== undefined ? m[READOUT] : -1;
			readout2Id = m[READOUT2] !== undefined ? m[READOUT2] : -1;
			if (d.type === 'plasticityReady') { els.count.textContent = d.count.toLocaleString() + ' 條'; setLog('大腦就緒，可以開始。'); }
		} else if (d.type === 'ruleStatus') {
			showRuleStatus(d.status, d.error);
		} else if (d.type === 'plasticity') {
			els.avg.textContent = d.avg.toFixed(3);
			els.avgBar.style.width = Math.min(100, d.avg / 2 * 100) + '%';
			els.range.textContent = d.min.toFixed(2) + ' ～ ' + d.max.toFixed(2);
			els.active.textContent = d.activeTraces.toLocaleString() + ' 條';
			els.dotR.className = 'tr-dot' + (d.reward > 0.05 ? ' on' : '');
			els.dotP.className = 'tr-dot pun' + (d.punish > 0.05 ? ' on' : '');
			els.learnToggle.textContent = '學習：' + (d.enabled ? '開' : '關');
			if (d.ruleStatus !== lastRule.status || d.ruleError !== lastRule.error) showRuleStatus(d.ruleStatus, d.ruleError);
		} else if (d.type === 'tick' && testing && d.groupSpikeCounts) {
			if (readoutId >= 0) testApp += d.groupSpikeCounts[readoutId] || 0;
			if (readout2Id >= 0) testFeed += d.groupSpikeCounts[readout2Id] || 0;
			if (--testTicksLeft <= 0) { testing = false; if (testDone) testDone(); }
		}
	}
	var lastRule = {status: null, error: null};
	function showRuleStatus(status, error) {
		lastRule = {status: status, error: error};
		var el = els.ruleStatus;
		if (status === 'ok') { el.className = 'tr-status ok'; el.textContent = '● 規則已載入，正在每一格呼叫你的 learningRule'; }
		else if (status === 'error') { el.className = 'tr-status err'; el.textContent = '✗ 規則有問題（學習已暫停，蒼蠅照常活著）\n' + error; }
		else { el.className = 'tr-status err'; el.textContent = '✗ ' + (error || '找不到規則'); }
	}

	/* ---------- 訓練與測試 ---------- */
	function setBusy(b) { busy = b; ['bOdor', 'bRew', 'bPun', 'bRew10', 'bPun10', 'bTest', 'bReset', 'bReload'].forEach(function (k) { els[k].disabled = b; }); }
	function setLog(t) { els.log.textContent = t; }

	function runTrial(kind) {
		return new Promise(function (resolve) {
			if (busy || !BRAIN.workerReady) { resolve(); return; }
			setBusy(true);
			var name = {odor: '只給氣味', reward: '氣味＋糖水', punish: '氣味＋電擊'}[kind];
			setLog(name + '…');
			var n = 0;
			var t = setInterval(function () {
				stim(ODOR);
				if (kind === 'reward') { stim(SUGAR); stim(DOPA_REW); post({type: 'dopamine', reward: 1}); }
				if (kind === 'punish') { post({type: 'dopamine', punish: 1}); }
				if (++n >= TRIAL_TICKS) {
					clearInterval(t);
					trials[kind]++;
					els.trialCount.textContent = trials.odor + ' / ' + trials.reward + ' / ' + trials.punish;
					setTimeout(function () { setBusy(false); setLog(name + ' 完成'); resolve(); }, GAP_MS);
				}
			}, 100);
		});
	}
	function runMany(kind, times) {
		if (busy) return;
		var i = 0;
		(function next() {
			if (i++ >= times) { setLog('連續 ' + times + ' 次完成，去按「測試反應」看看。'); return; }
			setLog('第 ' + i + ' / ' + times + ' 次…');
			runTrial(kind).then(next);
		})();
	}
	function runTest() {
		if (busy || !BRAIN.workerReady) return;
		setBusy(true); setLog('測試中：只給氣味，數「想靠近」神經元放電…');
		testApp = 0; testFeed = 0; testTicksLeft = TEST_TICKS; testing = true;
		var n = 0;
		var t = setInterval(function () { stim(ODOR); if (++n >= TRIAL_TICKS) clearInterval(t); }, 100);
		testDone = function () {
			var app = testApp, feed = testFeed;
			if (baseline === null) baseline = Math.max(app, 1);
			var ratio = app / baseline;
			history.push({app: app, feed: feed, ratio: ratio, trials: trials.reward + '🍬 ' + trials.punish + '⚡'});
			els.result.innerHTML = app.toLocaleString() + ' 次放電<small>「想靠近」神經元 · 是第一次的 ' + ratio.toFixed(2) + ' 倍 · 進食指令 ' + feed + ' 次</small>';
			renderHistory(); drawChart();
			setTimeout(function () { setBusy(false); setLog('測試完成。'); }, 400);
		};
	}
	function renderHistory() {
		els.hist.innerHTML = '';
		history.slice(-8).reverse().forEach(function (r, i, arr) {
			var n = history.length - i;
			els.hist.appendChild(h('div', {}, [h('span', {text: '#' + n + '  ' + r.trials}), h('span', {text: r.app + ' 次 · ' + r.ratio.toFixed(2) + '×'})]));
		});
	}
	function drawChart() {
		var c = els.chart, ctx = c.getContext('2d');
		var W = c.width = c.clientWidth * 2, H = c.height = 140;
		ctx.clearRect(0, 0, W, H);
		if (history.length < 1) return;
		var mx = Math.max(1.5, Math.max.apply(null, history.map(function (r) { return r.ratio; })));
		var pad = 16, n = history.length;
		ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 2;
		var y1 = H - pad - (1 / mx) * (H - 2 * pad);
		ctx.beginPath(); ctx.moveTo(pad, y1); ctx.lineTo(W - pad, y1); ctx.stroke();
		ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '20px system-ui'; ctx.fillText('1.0×', pad + 4, y1 - 6);
		ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 4; ctx.beginPath();
		history.forEach(function (r, i) {
			var x = n === 1 ? W / 2 : pad + i / (n - 1) * (W - 2 * pad);
			var y = H - pad - (r.ratio / mx) * (H - 2 * pad);
			i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
		});
		ctx.stroke();
		ctx.fillStyle = '#c4b5fd';
		history.forEach(function (r, i) {
			var x = n === 1 ? W / 2 : pad + i / (n - 1) * (W - 2 * pad);
			var y = H - pad - (r.ratio / mx) * (H - 2 * pad);
			ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
		});
	}

	function reloadRule() { post({type: 'reloadRule', bust: Date.now()}); setLog('重新載入規則檔…'); }
	function resetMemory() { post({type: 'resetPlasticity'}); baseline = null; history = []; trials = {odor: 0, reward: 0, punish: 0}; els.trialCount.textContent = '0 / 0 / 0'; els.result.innerHTML = '—<small>記憶已清除，重新測一次當基準</small>'; renderHistory(); drawChart(); setLog('所有突觸回到原本強度。'); }
	var learningOn = true;
	function toggleLearning() { learningOn = !learningOn; post({type: 'setLearning', enabled: learningOn}); }

	/* ---------- 開關 ---------- */
	function show() {
		if (!panel) buildPanel();
		if (window.EducationPanel && EducationPanel.active) EducationPanel.hide();
		panel.classList.add('open'); open = true;
		els.btn.classList.add('active');
		if (!pollTimer) pollTimer = setInterval(function () { post({type: 'getPlasticity'}); }, 400);
		post({type: 'getPlasticity'});
	}
	function hide() { if (panel) panel.classList.remove('open'); open = false; els.btn.classList.remove('active'); if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

	function init() {
		els.btn = document.getElementById('trainingBtn');
		if (!els.btn) return;
		els.btn.addEventListener('click', function () { open ? hide() : show(); });
		if (BRAIN.workerListeners) BRAIN.workerListeners.push(onWorker);
		else document.addEventListener('DOMContentLoaded', function () { BRAIN.workerListeners && BRAIN.workerListeners.push(onWorker); });
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
	window.TrainingGround = {show: show, hide: hide};
})();
