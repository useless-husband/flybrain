/* LIF neuron simulator Web Worker — T7.3 + T7.7 (neuropil-gated)
 *
 * Leaky integrate-and-fire simulation over the full Drosophila connectome.
 * Receives a binary connectome ArrayBuffer (optionally gzipped) on init.
 *
 * T7.7 optimizations:
 * - Neuropil-gated simulation: only tick neurons in active groups,
 *   lazy-activate groups when stimulation or synaptic input arrives.
 * - SIMD-friendly memory layout: neurons physically reordered by group
 *   so each group occupies a contiguous range in all typed arrays.
 *   CSR matrix remapped to match. (struct-of-arrays, group-sorted)
 * - Tick rate reduced to 10/sec; renderer interpolates brightness.
 *
 * Binary format (little-endian):
 *   Header:   2 x uint32  -- neuron_count, edge_count
 *   Edges:    edge_count x (uint32 pre, uint32 post, float32 weight), sorted by pre
 *   Metadata: neuron_count x (uint8 region_type, uint16 group_id)
 *
 * Message protocol:
 *   Main -> Worker: init, start, stop, stimulate, setStimulusState, setParams
 *   Worker -> Main: ready, tick, stats, error
 */

/* ---------- constants ---------- */
var DEFAULT_LEAK_RATE = 0.95;
var DEFAULT_THRESHOLD = 1.0;
var DEFAULT_REFRACTORY_PERIOD = 3;
var WEIGHT_SCALE = 0.15;
var TARGET_TICK_RATE = 10;
var MIN_TICK_RATE = 5;
var COOLDOWN_TICKS = 20;
var STATS_INTERVAL = 20;

/* ---------- module-level state ---------- */
var N = 0;
var edgeCount = 0;
var V = null;               // Float32Array[N] voltage (group-sorted)
var fired = null;            // Uint8Array[N] fire state (group-sorted)
var refractory = null;       // Uint8Array[N] refractory counter (group-sorted)
var rowPtr = null;           // Uint32Array[N+1] CSR row pointers (group-sorted)
var colIdx = null;           // Uint32Array[edgeCount] CSR col indices (group-sorted)
var values = null;           // Float32Array[edgeCount] CSR edge weights
var regionType = null;       // Uint8Array[N] region per neuron (group-sorted)
var groupId = null;          // Uint16Array[N] group per neuron (group-sorted)
var leakRate = DEFAULT_LEAK_RATE;
var threshold = DEFAULT_THRESHOLD;
var refractoryPeriod = DEFAULT_REFRACTORY_PERIOD;
var running = false;
var sustainedIndices = null;
var sustainedIntensities = null;
var tickCount = 0;
var targetTickRate = TARGET_TICK_RATE;
var tickTimeSum = 0;
var tickTimeSamples = 0;
var activeNeuronCount = 0;
var cumulativeFiredCount = 0;

/* ---------- 突觸可塑性（學習）---------- */
var ELIG_DECAY = 0.85;          /* 活躍痕跡每一格衰減 */
var DOPA_DECAY = 0.7;           /* 多巴胺訊號每一格衰減 */
var STRENGTH_MIN = 0.0;
var STRENGTH_MAX = 3.0;
var plasticPreG = -1;           /* 可塑突觸的「前」群組 */
var plasticCount = 0;
var plasticEdge = null;         /* Uint32Array  可塑突觸在 CSR 裡的位置 */
var plasticOrig = null;         /* Float32Array 原始權重 */
var plasticStrength = null;     /* Float32Array 目前倍率（1.0 = 原始） */
var plasticTrace = null;        /* Float32Array 活躍痕跡 */
var edgeToPlastic = null;       /* Int32Array[edgeCount] -1 或可塑索引 */
var rewardSignal = 0;
var punishSignal = 0;
var learningEnabled = true;
var ruleStatus = 'missing';
var ruleError = '';
var ruleFailed = false;
var ruleArg = {strength: 1, trace: 0, reward: 0, punish: 0};

/* neuropil-gated simulation structures (built by buildGroupStructures) */
var numGroups = 0;
var groupOffset = null;          // Uint32Array[numGroups+1] prefix sum
var groupActive = null;          // Uint8Array[numGroups]
var groupCooldown = null;        // Uint8Array[numGroups]
var groupRecvInput = null;       // Uint8Array[numGroups] per-tick scratch
var groupFiredThisTick = null;   // Uint8Array[numGroups] per-tick scratch
var groupStimulatedThisTick = null; // Uint8Array[numGroups] per-tick scratch

/* ---------- decompressGzip ---------- */

async function decompressGzip(buffer) {
	var ds = new DecompressionStream('gzip');
	var writer = ds.writable.getWriter();
	writer.write(new Uint8Array(buffer));
	writer.close();
	var reader = ds.readable.getReader();
	var chunks = [];
	while (true) {
		var result = await reader.read();
		if (result.done) break;
		chunks.push(result.value);
	}
	var totalLen = 0;
	for (var c = 0; c < chunks.length; c++) {
		totalLen += chunks[c].byteLength;
	}
	var out = new Uint8Array(totalLen);
	var offset = 0;
	for (var c = 0; c < chunks.length; c++) {
		out.set(chunks[c], offset);
		offset += chunks[c].byteLength;
	}
	return out.buffer;
}

/* ---------- parseBinary ---------- */

function parseBinary(buffer) {
	var view = new DataView(buffer);
	N = view.getUint32(0, true);
	edgeCount = view.getUint32(4, true);

	var edgeOffset = 8;
	var metaOffset = edgeOffset + edgeCount * 12;

	/* allocate CSR arrays (original index space, remapped later) */
	rowPtr = new Uint32Array(N + 1);
	colIdx = new Uint32Array(edgeCount);
	values = new Float32Array(edgeCount);

	/* first pass -- count outgoing edges per neuron */
	for (var e = 0; e < edgeCount; e++) {
		var pre = view.getUint32(edgeOffset + e * 12, true);
		rowPtr[pre + 1]++;
	}

	/* prefix sum -- convert counts to cumulative offsets */
	for (var i = 1; i <= N; i++) {
		rowPtr[i] += rowPtr[i - 1];
	}

	/* second pass -- fill colIdx, values, find maxAbsWeight */
	var maxAbsW = 0;
	for (var e = 0; e < edgeCount; e++) {
		var base = edgeOffset + e * 12;
		colIdx[e] = view.getUint32(base + 4, true);
		var rawW = view.getFloat32(base + 8, true);
		values[e] = rawW;
		var absW = rawW < 0 ? -rawW : rawW;
		if (absW > maxAbsW) maxAbsW = absW;
	}

	/* normalize weights */
	if (maxAbsW > 0) {
		for (var e = 0; e < edgeCount; e++) {
			values[e] = (values[e] / maxAbsW) * WEIGHT_SCALE;
		}
	}

	/* read per-neuron metadata (original order) */
	regionType = new Uint8Array(N);
	groupId = new Uint16Array(N);
	for (var i = 0; i < N; i++) {
		regionType[i] = view.getUint8(metaOffset + i * 3);
		groupId[i] = view.getUint16(metaOffset + i * 3 + 1, true);
	}

	/* allocate simulation state */
	V = new Float32Array(N);
	fired = new Uint8Array(N);
	refractory = new Uint8Array(N);
	tickCount = 0;
}

/* ---------- buildGroupStructures ---------- */
/* Reorders all per-neuron arrays and the CSR matrix so neurons within each
 * group occupy a contiguous range. Enables cache-friendly iteration over
 * only active groups (neuropil gating) and SIMD-friendly memory access. */

function buildGroupStructures() {
	/* determine number of groups */
	numGroups = 0;
	for (var i = 0; i < N; i++) {
		if (groupId[i] >= numGroups) numGroups = groupId[i] + 1;
	}

	/* count neurons per group */
	var counts = new Uint32Array(numGroups);
	for (var i = 0; i < N; i++) {
		counts[groupId[i]]++;
	}

	/* build prefix-sum offsets */
	groupOffset = new Uint32Array(numGroups + 1);
	for (var g = 0; g < numGroups; g++) {
		groupOffset[g + 1] = groupOffset[g] + counts[g];
	}

	/* build sortedByGroup: sortedByGroup[sorted_pos] = original_index */
	var sortedByGroup = new Uint32Array(N);
	var writePos = new Uint32Array(numGroups);
	for (var g = 0; g < numGroups; g++) writePos[g] = groupOffset[g];
	for (var i = 0; i < N; i++) {
		var g = groupId[i];
		sortedByGroup[writePos[g]++] = i;
	}

	/* reverse mapping: originalToSorted[original_index] = sorted_pos */
	var originalToSorted = new Uint32Array(N);
	for (var s = 0; s < N; s++) {
		originalToSorted[sortedByGroup[s]] = s;
	}

	/* remap CSR to sorted index space */
	var newRowPtr = new Uint32Array(N + 1);
	for (var s = 0; s < N; s++) {
		var o = sortedByGroup[s];
		newRowPtr[s + 1] = rowPtr[o + 1] - rowPtr[o];
	}
	for (var s = 1; s <= N; s++) {
		newRowPtr[s] += newRowPtr[s - 1];
	}
	var newColIdx = new Uint32Array(edgeCount);
	var newValues = new Float32Array(edgeCount);
	for (var s = 0; s < N; s++) {
		var o = sortedByGroup[s];
		var wp = newRowPtr[s];
		for (var j = rowPtr[o]; j < rowPtr[o + 1]; j++) {
			newColIdx[wp] = originalToSorted[colIdx[j]];
			newValues[wp] = values[j];
			wp++;
		}
	}
	rowPtr = newRowPtr;
	colIdx = newColIdx;
	values = newValues;

	/* remap per-neuron metadata to sorted order */
	var newGroupId = new Uint16Array(N);
	var newRegionType = new Uint8Array(N);
	for (var s = 0; s < N; s++) {
		newGroupId[s] = groupId[sortedByGroup[s]];
		newRegionType[s] = regionType[sortedByGroup[s]];
	}
	groupId = newGroupId;
	regionType = newRegionType;

	/* V, fired, refractory are zero-initialized -- no remap needed */

	/* allocate per-group activation state */
	groupActive = new Uint8Array(numGroups);
	groupCooldown = new Uint8Array(numGroups);
	groupRecvInput = new Uint8Array(numGroups);
	groupFiredThisTick = new Uint8Array(numGroups);
	groupStimulatedThisTick = new Uint8Array(numGroups);
}

/* ---------- tick (neuropil-gated) ---------- */

function tick() {
	var t0 = performance.now();
	var firedNeuronCount = 0;
	var groupSpikeCounts = new Uint16Array(numGroups);

	/* reset per-tick scratch */
	groupRecvInput.fill(0);
	groupFiredThisTick.fill(0);
	groupStimulatedThisTick.fill(0);
	activeNeuronCount = 0;

	/* activate groups with sustained stimulation */
	if (sustainedIndices) {
		for (var k = 0; k < sustainedIndices.length; k++) {
			var si = sustainedIndices[k];
			if (si < N) {
				var g = groupId[si];
				groupStimulatedThisTick[g] = 1;
				if (!groupActive[g]) {
					groupActive[g] = 1;
					groupCooldown[g] = COOLDOWN_TICKS;
				}
			}
		}
	}

	/* step 1 -- decay V and refractory for active groups (contiguous access) */
	for (var g = 0; g < numGroups; g++) {
		if (!groupActive[g]) continue;
		var start = groupOffset[g];
		var end = groupOffset[g + 1];
		activeNeuronCount += end - start;
		for (var i = start; i < end; i++) {
			if (refractory[i] > 0) {
				refractory[i]--;
				V[i] = 0;
			} else {
				V[i] *= leakRate;
			}
		}
	}

	/* step 1.5 -- apply sustained external stimulation */
	if (sustainedIndices) {
		for (var k = 0; k < sustainedIndices.length; k++) {
			var si = sustainedIndices[k];
			if (si < N && refractory[si] === 0) {
				V[si] += sustainedIntensities[k];
			}
		}
	}

	/* step 2 -- propagate from fired neurons in active groups */
	for (var g = 0; g < numGroups; g++) {
		if (!groupActive[g]) continue;
		var isPlasticPre = (plasticCount > 0 && g === plasticPreG);
		for (var i = groupOffset[g]; i < groupOffset[g + 1]; i++) {
			if (fired[i] === 0) continue;
			for (var j = rowPtr[i]; j < rowPtr[i + 1]; j++) {
				var target = colIdx[j];
				V[target] += values[j];
				groupRecvInput[groupId[target]] = 1;
				if (isPlasticPre) {
					var pIdx = edgeToPlastic[j];
					if (pIdx >= 0) plasticTrace[pIdx] = 1;   /* 這條突觸剛被用到 */
				}
			}
		}
	}

	/* activate groups that received synaptic input */
	for (var g = 0; g < numGroups; g++) {
		if (groupRecvInput[g] && !groupActive[g]) {
			groupActive[g] = 1;
			groupCooldown[g] = COOLDOWN_TICKS;
		}
	}

	/* step 3 -- clear fired + threshold check for active groups */
	for (var g = 0; g < numGroups; g++) {
		if (!groupActive[g]) continue;
		var start = groupOffset[g];
		var end = groupOffset[g + 1];
		for (var i = start; i < end; i++) {
			fired[i] = 0;
			if (refractory[i] === 0 && V[i] >= threshold) {
				fired[i] = 1;
				V[i] = 0;
				refractory[i] = refractoryPeriod;
				groupFiredThisTick[g] = 1;
				groupSpikeCounts[g]++;
				firedNeuronCount++;
			}
		}
	}

	/* step 4 -- 突觸可塑性：呼叫使用者寫的學習規則 */
	applyPlasticity();

	/* update group cooldowns -- deactivate idle groups */
	for (var g = 0; g < numGroups; g++) {
		if (!groupActive[g]) continue;
		if (groupFiredThisTick[g] || groupRecvInput[g] || groupStimulatedThisTick[g]) {
			groupCooldown[g] = COOLDOWN_TICKS;
		} else {
			groupCooldown[g]--;
			if (groupCooldown[g] <= 0) {
				groupActive[g] = 0;
				/* clear residual state for deactivated group */
				var start = groupOffset[g];
				var end = groupOffset[g + 1];
				V.fill(0, start, end);
				fired.fill(0, start, end);
				refractory.fill(0, start, end);
			}
		}
	}

	/* post fire state to main thread */
	self.postMessage({
		type: 'tick',
		fireState: fired,
		firedNeurons: firedNeuronCount,
		groupSpikeCounts: groupSpikeCounts,
		tickCount: tickCount
	});
	tickCount++;

	/* performance stats */
	var elapsed = performance.now() - t0;
	tickTimeSum += elapsed;
	tickTimeSamples++;
	cumulativeFiredCount += firedNeuronCount;

	if (tickTimeSamples >= STATS_INTERVAL) {
		var avgMs = tickTimeSum / tickTimeSamples;
		var avgFired = Math.round(cumulativeFiredCount / tickTimeSamples);
		var activeGroups = 0;
		for (var g = 0; g < numGroups; g++) {
			if (groupActive[g]) activeGroups++;
		}
		self.postMessage({
			type: 'stats',
			avgTickMs: avgMs,
			firedNeurons: avgFired,
			activeNeurons: activeNeuronCount,
			totalNeurons: N,
			activeGroups: activeGroups,
			totalGroups: numGroups,
			tickRate: targetTickRate
		});
		tickTimeSum = 0;
		tickTimeSamples = 0;
		cumulativeFiredCount = 0;
	}

	/* schedule next tick at target rate */
	if (running) {
		var interval = Math.max(0, Math.floor(1000 / targetTickRate - elapsed));
		setTimeout(tick, interval);
	}
}

/* ---------- 突觸可塑性 ---------- */

function loadRule(bust) {
	try {
		self.learningRule = undefined;
		importScripts('learning-rule.js' + (bust ? '?t=' + bust : ''));
		if (typeof self.learningRule !== 'function') {
			ruleStatus = 'missing';
			ruleError = '檔案裡找不到名叫 learningRule 的函式';
		} else {
			ruleStatus = 'ok';
			ruleError = '';
		}
	} catch (err) {
		ruleStatus = 'error';
		ruleError = err.message;
	}
	ruleFailed = false;
	self.postMessage({type: 'ruleStatus', status: ruleStatus, error: ruleError});
}

function setupPlasticity(preG, postG) {
	if (N === 0 || !groupOffset) return;
	plasticPreG = preG;
	edgeToPlastic = new Int32Array(edgeCount).fill(-1);
	var cnt = 0;
	var gStart = groupOffset[preG], gEnd = groupOffset[preG + 1];
	for (var i = gStart; i < gEnd; i++) {
		for (var j = rowPtr[i]; j < rowPtr[i + 1]; j++) {
			if (groupId[colIdx[j]] === postG) cnt++;
		}
	}
	plasticCount = cnt;
	plasticEdge = new Uint32Array(cnt);
	plasticOrig = new Float32Array(cnt);
	plasticStrength = new Float32Array(cnt).fill(1);
	plasticTrace = new Float32Array(cnt);
	var k = 0;
	for (var i = gStart; i < gEnd; i++) {
		for (var j = rowPtr[i]; j < rowPtr[i + 1]; j++) {
			if (groupId[colIdx[j]] === postG) {
				plasticEdge[k] = j;
				plasticOrig[k] = values[j];
				edgeToPlastic[j] = k;
				k++;
			}
		}
	}
	self.postMessage({type: 'plasticityReady', count: cnt});
}

function applyPlasticity() {
	if (plasticCount === 0) return;
	rewardSignal *= DOPA_DECAY;
	punishSignal *= DOPA_DECAY;
	if (rewardSignal < 0.01) rewardSignal = 0;
	if (punishSignal < 0.01) punishSignal = 0;
	var canLearn = learningEnabled && ruleStatus === 'ok' && !ruleFailed;
	for (var p = 0; p < plasticCount; p++) {
		if (canLearn) {
			ruleArg.strength = plasticStrength[p];
			ruleArg.trace = plasticTrace[p];
			ruleArg.reward = rewardSignal;
			ruleArg.punish = punishSignal;
			var ns;
			try {
				ns = self.learningRule(ruleArg);
			} catch (err) {
				ruleFailed = true;
				self.postMessage({type: 'ruleStatus', status: 'error', error: '執行到一半出錯：' + err.message});
				break;
			}
			if (typeof ns !== 'number' || ns !== ns) {
				ruleFailed = true;
				self.postMessage({type: 'ruleStatus', status: 'error',
					error: 'learningRule 必須 return 一個數字，現在回傳的是 ' + (ns !== ns ? 'NaN（不是數字）' : typeof ns)});
				break;
			}
			if (ns < STRENGTH_MIN) ns = STRENGTH_MIN;
			if (ns > STRENGTH_MAX) ns = STRENGTH_MAX;
			if (ns !== plasticStrength[p]) {
				plasticStrength[p] = ns;
				values[plasticEdge[p]] = plasticOrig[p] * ns;
			}
		}
		plasticTrace[p] *= ELIG_DECAY;
	}
}

function reportPlasticity() {
	var sum = 0, mn = Infinity, mx = -Infinity, active = 0;
	for (var p = 0; p < plasticCount; p++) {
		var v = plasticStrength[p];
		sum += v;
		if (v < mn) mn = v;
		if (v > mx) mx = v;
		if (plasticTrace[p] > 0.1) active++;
	}
	self.postMessage({
		type: 'plasticity',
		count: plasticCount,
		avg: plasticCount ? sum / plasticCount : 1,
		min: plasticCount ? mn : 1,
		max: plasticCount ? mx : 1,
		activeTraces: active,
		reward: rewardSignal,
		punish: punishSignal,
		enabled: learningEnabled,
		ruleStatus: ruleFailed ? 'error' : ruleStatus,
		ruleError: ruleError
	});
}

/* ---------- message handler ---------- */

self.onmessage = function (e) {
	switch (e.data.type) {

	case 'init':
		try {
			var buffer = e.data.buffer;

			function postReady() {
				buildGroupStructures();
				self.postMessage({type: 'ready', neuronCount: N, edgeCount: edgeCount,
					groupId: groupId, regionType: regionType});
			}

			var header = new Uint8Array(buffer, 0, 2);
			if (header[0] === 0x1f && header[1] === 0x8b) {
				decompressGzip(buffer).then(function (raw) {
					parseBinary(raw);
					postReady();
				}).catch(function (err) {
					self.postMessage({type: 'error', message: 'Decompression failed: ' + err.message});
				});
				return;
			}

			parseBinary(buffer);
			postReady();
		} catch (err) {
			self.postMessage({type: 'error', message: 'Init failed: ' + err.message});
		}
		break;

	case 'start':
		if (N === 0) {
			self.postMessage({type: 'error', message: 'Cannot start: not initialized'});
			return;
		}
		running = true;
		setTimeout(tick, 0);
		break;

	case 'stop':
		running = false;
		break;

	case 'stimulate':
		var indices = e.data.indices;
		var intensities = e.data.intensities;
		for (var k = 0; k < indices.length; k++) {
			var idx = indices[k];
			if (idx < N) {
				V[idx] += intensities[k];
				/* activate target group for neuropil gating */
				if (groupActive && !groupActive[groupId[idx]]) {
					groupActive[groupId[idx]] = 1;
					groupCooldown[groupId[idx]] = COOLDOWN_TICKS;
				}
			}
		}
		break;

	case 'setStimulusState':
		sustainedIndices = e.data.indices;
		sustainedIntensities = e.data.intensities;
		break;

	case 'reset':
		if (N === 0) break;
		V.fill(0);
		fired.fill(0);
		refractory.fill(0);
		sustainedIndices = null;
		sustainedIntensities = null;
		if (groupActive) {
			groupActive.fill(0);
			groupCooldown.fill(0);
			groupRecvInput.fill(0);
			groupFiredThisTick.fill(0);
			groupStimulatedThisTick.fill(0);
		}
		tickTimeSum = 0;
		tickTimeSamples = 0;
		cumulativeFiredCount = 0;
		activeNeuronCount = 0;
		break;

	case 'setPlasticity':
		setupPlasticity(e.data.pre, e.data.post);
		break;

	case 'dopamine':
		if (e.data.reward !== undefined) rewardSignal = Math.max(rewardSignal, e.data.reward);
		if (e.data.punish !== undefined) punishSignal = Math.max(punishSignal, e.data.punish);
		break;

	case 'getPlasticity':
		reportPlasticity();
		break;

	case 'resetPlasticity':
		if (plasticCount > 0) {
			for (var p = 0; p < plasticCount; p++) {
				plasticStrength[p] = 1;
				plasticTrace[p] = 0;
				values[plasticEdge[p]] = plasticOrig[p];
			}
		}
		rewardSignal = 0;
		punishSignal = 0;
		break;

	case 'reloadRule':
		loadRule(e.data.bust || Date.now());
		break;

	case 'setLearning':
		learningEnabled = !!e.data.enabled;
		break;

	case 'setParams':
		if (e.data.leakRate !== undefined) leakRate = e.data.leakRate;
		if (e.data.threshold !== undefined) threshold = e.data.threshold;
		if (e.data.refractoryPeriod !== undefined) refractoryPeriod = e.data.refractoryPeriod;
		break;
	}
};

/* 啟動時先載入一次學習規則 */
loadRule();
