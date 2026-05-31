const board = document.getElementById("board");
const placementLayer = document.getElementById("placementLayer");
const stats = document.getElementById("stats");
const hoverInfo = document.getElementById("hoverInfo");
const patternText = document.getElementById("patternText");
const compareText = document.getElementById("compareText");

const gridWInput = document.getElementById("gridW");
const gridHInput = document.getElementById("gridH");
const treasureWInput = document.getElementById("treasureW");
const treasureHInput = document.getElementById("treasureH");
const targetPctInput = document.getElementById("targetPct");
const solverModeInput = document.getElementById("solverMode");
const showCoverageInput = document.getElementById("showCoverage");

let selected = new Set();
let lastStepPick = null;
let pendingHover = null;
let hoverFrame = null;
let lastHoverKey = null;
let lastExactStatus = "";
let cachedOptimalSignature = "";
let cachedOptimalSolution = [];

function key(r, c) {
  return `${r},${c}`;
}

function parseKey(k) {
  return k.split(",").map(Number);
}

function clampInputs() {
  const gridW = Math.max(2, Math.min(20, Number(gridWInput.value || 10)));
  const gridH = Math.max(2, Math.min(20, Number(gridHInput.value || 10)));
  const treasureW = Math.max(1, Math.min(gridW, Number(treasureWInput.value || 1)));
  const treasureH = Math.max(1, Math.min(gridH, Number(treasureHInput.value || 1)));
  const targetPct = Math.max(1, Math.min(100, Number(targetPctInput.value || 100)));

  gridWInput.value = gridW;
  gridHInput.value = gridH;
  treasureWInput.value = treasureW;
  treasureHInput.value = treasureH;
  targetPctInput.value = targetPct;

  return { gridW, gridH, treasureW, treasureH, targetPct };
}

function allPlacements(gridW, gridH, treasureW, treasureH) {
  const placements = [];
  for (let r = 0; r <= gridH - treasureH; r++) {
    for (let c = 0; c <= gridW - treasureW; c++) {
      const cells = [];
      for (let rr = r; rr < r + treasureH; rr++) {
        for (let cc = c; cc < c + treasureW; cc++) {
          cells.push(key(rr, cc));
        }
      }
      placements.push({ r, c, cells });
    }
  }
  return placements;
}

function coveredPlacements(sel, placements) {
  let covered = 0;
  for (const p of placements) {
    if (p.cells.some(cell => sel.has(cell))) covered++;
  }
  return covered;
}

function targetNeeded(placements, targetPct) {
  return Math.ceil(placements.length * targetPct / 100);
}

function render() {
  const { gridW, gridH } = clampInputs();
  board.innerHTML = "";
  board.style.gridTemplateColumns = `repeat(${gridW}, 1fr)`;

  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const div = document.createElement("div");
      div.className = "cell coord";
      div.dataset.label = `${r + 1},${c + 1}`;
      div.textContent = selected.has(key(r, c)) ? "X" : "";
      if (selected.has(key(r, c))) div.classList.add("selected");
      if (lastStepPick === key(r, c)) div.classList.add("step-pick");

      div.addEventListener("mouseenter", () => queueHover(r, c));
      div.addEventListener("mouseleave", clearHover);

      div.addEventListener("click", () => {
        const k = key(r, c);
        if (selected.has(k)) selected.delete(k);
        else selected.add(k);
        lastStepPick = null;
        lastExactStatus = "";
        render();
      });

      board.appendChild(div);
    }
  }

  requestAnimationFrame(renderCoverageOverlay);
  updateStats();
}

function queueHover(r, c) {
  pendingHover = { r, c };
  const hoverKey = key(r, c);
  if (hoverKey === lastHoverKey) return;
  lastHoverKey = hoverKey;

  if (hoverFrame) cancelAnimationFrame(hoverFrame);
  hoverFrame = requestAnimationFrame(() => {
    if (!pendingHover) return;
    showHover(pendingHover.r, pendingHover.c);
    hoverFrame = null;
  });
}

function clearHover() {
  pendingHover = null;
  lastHoverKey = null;
  if (hoverFrame) {
    cancelAnimationFrame(hoverFrame);
    hoverFrame = null;
  }
  hoverInfo.textContent = "Hover a square to see coverage gain.\n\n";
}

function showHover(r, c) {
  const { gridW, gridH, treasureW, treasureH } = clampInputs();
  const placements = allPlacements(gridW, gridH, treasureW, treasureH);
  const baseCovered = coveredPlacements(selected, placements);
  const test = new Set(selected);
  test.add(key(r, c));
  const withCovered = coveredPlacements(test, placements);
  const totalForCell = placements.filter(p => p.cells.includes(key(r, c))).length;

  hoverInfo.textContent =
    `Square: (${r + 1},${c + 1})\n` +
    `Total placements touching this square: ${totalForCell}\n` +
    `New placements gained: ${withCovered - baseCovered}`;
}

function updateStats() {
  const { gridW, gridH, treasureW, treasureH, targetPct } = clampInputs();
  const placements = allPlacements(gridW, gridH, treasureW, treasureH);
  const covered = coveredPlacements(selected, placements);
  const pct = placements.length ? (covered / placements.length * 100) : 0;
  const need = targetNeeded(placements, targetPct);

  stats.innerHTML = `
    <b>Clicks:</b> ${selected.size}<br>
    <b>Treasure placements hit:</b> ${covered}/${placements.length}<br>
    <b>Hit chance:</b> ${pct.toFixed(2)}%<br>
    <b>Target:</b> ${need}/${placements.length} placements
    ${lastExactStatus ? `<br><span class="warning">${lastExactStatus}</span>` : ""}
  `;

  patternText.textContent = patternAsText();
}

function renderCoverageOverlay() {
  placementLayer.innerHTML = "";
  if (!showCoverageInput.checked) return;

  const { gridW, gridH, treasureW, treasureH } = clampInputs();
  const placements = allPlacements(gridW, gridH, treasureW, treasureH);
  const first = board.querySelector(".cell");
  if (!first) return;

  const boardRect = board.getBoundingClientRect();
  const wrapRect = board.parentElement.getBoundingClientRect();
  const cellRect = first.getBoundingClientRect();
  const gap = 4;
  const pitchX = cellRect.width + gap;
  const pitchY = cellRect.height + gap;

  placementLayer.style.left = `${boardRect.left - wrapRect.left}px`;
  placementLayer.style.top = `${boardRect.top - wrapRect.top}px`;
  placementLayer.style.width = `${boardRect.width}px`;
  placementLayer.style.height = `${boardRect.height}px`;

  for (const p of placements) {
    const hit = p.cells.some(cell => selected.has(cell));
    const div = document.createElement("div");
    div.className = `placement ${hit ? "hit" : "miss"}`;
    div.style.left = `${p.c * pitchX}px`;
    div.style.top = `${p.r * pitchY}px`;
    div.style.width = `${treasureW * cellRect.width + (treasureW - 1) * gap}px`;
    div.style.height = `${treasureH * cellRect.height + (treasureH - 1) * gap}px`;
    placementLayer.appendChild(div);
  }
}

function patternAsText() {
  const { gridW, gridH } = clampInputs();
  let lines = [];
  for (let r = 0; r < gridH; r++) {
    let row = [];
    for (let c = 0; c < gridW; c++) {
      row.push(selected.has(key(r, c)) ? "X" : ".");
    }
    lines.push(row.join(" "));
  }

  const coords = [...selected]
    .map(parseKey)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([r, c]) => `(${r + 1},${c + 1})`)
    .join(" ");

  return `${lines.join("\n")}\n\nCoordinates:\n${coords || "(none)"}`;
}

function solvePrettyGuarantee(gridW, gridH, treasureW, treasureH) {
  const chosen = new Set();

  for (let r = treasureH - 1; r < gridH; r += treasureH) {
    for (let c = treasureW - 1; c < gridW; c += treasureW) {
      chosen.add(key(r, c));
    }
  }

  return chosen;
}

function solveGreedySet(targetPctOverride = null) {
  const { gridW, gridH, treasureW, treasureH, targetPct } = clampInputs();
  const placements = allPlacements(gridW, gridH, treasureW, treasureH);
  const need = targetNeeded(placements, targetPctOverride ?? targetPct);

  const uncovered = new Set(placements.map((_, i) => i));
  const chosen = new Set();
  const cellToPlacements = buildCellToPlacements(placements);

  while (placements.length - uncovered.size < need) {
    const bestCell = chooseBestCell(cellToPlacements, uncovered, chosen, treasureW, treasureH);
    if (!bestCell) break;
    chosen.add(bestCell);
    for (const idx of cellToPlacements.get(bestCell)) uncovered.delete(idx);
  }

  removeRedundant(chosen, placements, need);
  return chosen;
}

function solveExactOptimal() {
  const { gridW, gridH, treasureW, treasureH, targetPct } = clampInputs();
  const placements = allPlacements(gridW, gridH, treasureW, treasureH);
  const need = targetNeeded(placements, targetPct);
  const cellMasks = buildCellMasks(gridW, gridH, placements);

  const usefulCells = cellMasks
    .filter(x => bitCount(x.mask) > 0)
    .sort((a, b) => bitCount(b.mask) - bitCount(a.mask));

  const greedyStart = solveGreedySet(targetPct);
  let best = [...greedyStart];
  let bestSize = best.length;

  lastExactStatus = "Exact search running...";

  for (let k = 1; k < bestSize; k++) {
    const result = exactSearchK(usefulCells, need, k, 0, 0n, [], Date.now(), 3500);
    if (result.found) {
      best = result.solution;
      bestSize = k;
      lastExactStatus = `Exact optimal proven: ${k} clicks.`;
      return new Set(best);
    }

    if (result.timedOut) {
      lastExactStatus = `Exact search timed out. Returned best known solution: ${bestSize} clicks.`;
      return new Set(best);
    }
  }

  lastExactStatus = `Exact optimal proven: ${bestSize} clicks.`;
  return new Set(best);
}

function buildCellMasks(gridW, gridH, placements) {
  const out = [];
  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const cell = key(r, c);
      let mask = 0n;
      for (let i = 0; i < placements.length; i++) {
        if (placements[i].cells.includes(cell)) {
          mask |= 1n << BigInt(i);
        }
      }
      out.push({ cell, mask });
    }
  }
  return out;
}

function exactSearchK(cells, need, k, start, coveredMask, chosen, startedAt, timeLimitMs) {
  if (Date.now() - startedAt > timeLimitMs) {
    return { found: false, timedOut: true, solution: [] };
  }

  const covered = bitCount(coveredMask);
  if (covered >= need) {
    return { found: true, timedOut: false, solution: [...chosen] };
  }

  const remainingPicks = k - chosen.length;
  if (remainingPicks <= 0 || start >= cells.length) {
    return { found: false, timedOut: false, solution: [] };
  }

  const gains = [];
  for (let i = start; i < cells.length; i++) {
    gains.push(bitCount(cells[i].mask & ~coveredMask));
  }
  gains.sort((a, b) => b - a);

  let possible = covered;
  for (let i = 0; i < remainingPicks && i < gains.length; i++) possible += gains[i];
  if (possible < need) {
    return { found: false, timedOut: false, solution: [] };
  }

  for (let i = start; i <= cells.length - remainingPicks; i++) {
    const nextMask = coveredMask | cells[i].mask;
    if (nextMask === coveredMask) continue;

    chosen.push(cells[i].cell);
    const result = exactSearchK(cells, need, k, i + 1, nextMask, chosen, startedAt, timeLimitMs);
    if (result.found || result.timedOut) return result;
    chosen.pop();
  }

  return { found: false, timedOut: false, solution: [] };
}

function bitCount(n) {
  let count = 0;
  while (n) {
    n &= n - 1n;
    count++;
  }
  return count;
}

function buildCellToPlacements(placements) {
  const cellToPlacements = new Map();
  for (let i = 0; i < placements.length; i++) {
    for (const cell of placements[i].cells) {
      if (!cellToPlacements.has(cell)) cellToPlacements.set(cell, []);
      cellToPlacements.get(cell).push(i);
    }
  }
  return cellToPlacements;
}

function chooseBestCell(cellToPlacements, uncovered, chosen, treasureW, treasureH) {
  let bestCell = null;
  let bestGain = -1;

  for (const [cell, list] of cellToPlacements.entries()) {
    if (chosen.has(cell)) continue;
    let gain = 0;
    for (const idx of list) {
      if (uncovered.has(idx)) gain++;
    }

    if (gain > bestGain || (gain === bestGain && betterTieBreak(cell, bestCell, treasureW, treasureH))) {
      bestGain = gain;
      bestCell = cell;
    }
  }

  return bestGain > 0 ? bestCell : null;
}

function betterTieBreak(cell, bestCell, treasureW, treasureH) {
  if (bestCell === null) return true;
  const [r, c] = parseKey(cell);
  const [br, bc] = parseKey(bestCell);

  const score = ((r + 1) % treasureH === 0 ? 1 : 0) + ((c + 1) % treasureW === 0 ? 1 : 0);
  const bestScore = ((br + 1) % treasureH === 0 ? 1 : 0) + ((bc + 1) % treasureW === 0 ? 1 : 0);
  if (score !== bestScore) return score > bestScore;

  return r < br || (r === br && c < bc);
}

function removeRedundant(chosen, placements, need) {
  let improved = true;
  while (improved) {
    improved = false;
    for (const cell of [...chosen]) {
      const test = new Set(chosen);
      test.delete(cell);
      if (coveredPlacements(test, placements) >= need) {
        chosen.delete(cell);
        improved = true;
      }
    }
  }
}

function solveRandomSample() {
  const { gridW, gridH, targetPct, treasureW, treasureH } = clampInputs();
  const placements = allPlacements(gridW, gridH, treasureW, treasureH);
  const need = targetNeeded(placements, targetPct);
  const cells = [];

  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) cells.push(key(r, c));
  }

  let best = new Set(cells);
  for (let trial = 0; trial < 500; trial++) {
    const shuffled = [...cells].sort(() => Math.random() - 0.5);
    const chosen = new Set();

    for (const cell of shuffled) {
      if (coveredPlacements(chosen, placements) >= need) break;
      chosen.add(cell);
    }

    removeRedundant(chosen, placements, need);
    if (chosen.size < best.size) best = chosen;
  }

  return best;
}


function currentProblemSignature() {
  const { gridW, gridH, treasureW, treasureH, targetPct } = clampInputs();
  return `${gridW}x${gridH}|${treasureW}x${treasureH}|${targetPct}`;
}

function getOptimalSolutionForCurrentProblem() {
  const sig = currentProblemSignature();
  if (cachedOptimalSignature === sig && cachedOptimalSolution.length > 0) {
    return cachedOptimalSolution;
  }

  const oldStatus = lastExactStatus;
  const solutionSet = solveExactOptimal();
  cachedOptimalSignature = sig;
  cachedOptimalSolution = [...solutionSet]
    .map(parseKey)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([r, c]) => key(r, c));

  // Keep the exact status from solveExactOptimal unless this was only a cached prep.
  if (!lastExactStatus) lastExactStatus = oldStatus;
  return cachedOptimalSolution;
}

function stepExactOptimal() {
  const { gridW, gridH, treasureW, treasureH, targetPct } = clampInputs();
  const placements = allPlacements(gridW, gridH, treasureW, treasureH);
  const need = targetNeeded(placements, targetPct);

  if (coveredPlacements(selected, placements) >= need) {
    lastExactStatus = "Target already reached.";
    render();
    return;
  }

  const solution = getOptimalSolutionForCurrentProblem();

  for (const cell of solution) {
    if (!selected.has(cell)) {
      selected.add(cell);
      lastStepPick = cell;
      lastExactStatus = "Stepped exact optimal solution.";
      render();
      return;
    }
  }

  lastExactStatus = "Optimal solution is already fully placed.";
  render();
}

function stepPrettyGuarantee() {
  const { gridW, gridH, treasureW, treasureH, targetPct } = clampInputs();
  if (targetPct !== 100) {
    stepGreedy();
    return;
  }

  const solution = [...solvePrettyGuarantee(gridW, gridH, treasureW, treasureH)]
    .map(parseKey)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([r, c]) => key(r, c));

  for (const cell of solution) {
    if (!selected.has(cell)) {
      selected.add(cell);
      lastStepPick = cell;
      lastExactStatus = "Stepped pretty guarantee pattern.";
      render();
      return;
    }
  }

  lastExactStatus = "Pretty guarantee pattern is already fully placed.";
  render();
}

function stepMode() {
  const mode = solverModeInput.value;
  if (mode === "exact") {
    stepExactOptimal();
  } else if (mode === "pretty") {
    stepPrettyGuarantee();
  } else {
    stepGreedy();
  }
}


function solvePattern() {
  const { gridW, gridH, treasureW, treasureH, targetPct } = clampInputs();
  const mode = solverModeInput.value;
  lastExactStatus = "";

  if (mode === "exact") {
    selected = solveExactOptimal();
    cachedOptimalSignature = currentProblemSignature();
    cachedOptimalSolution = [...selected]
      .map(parseKey)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([r, c]) => key(r, c));
  } else if (mode === "pretty" && targetPct === 100) {
    cachedOptimalSignature = "";
    cachedOptimalSolution = [];
    selected = solvePrettyGuarantee(gridW, gridH, treasureW, treasureH);
    lastExactStatus = "Pretty guarantee generated.";
  } else if (mode === "random") {
    cachedOptimalSignature = "";
    cachedOptimalSolution = [];
    selected = solveRandomSample();
    lastExactStatus = "Random sample generated.";
  } else {
    cachedOptimalSignature = "";
    cachedOptimalSolution = [];
    selected = solveGreedySet();
    lastExactStatus = "Greedy fast generated.";
  }

  lastStepPick = null;
  render();
}

function stepGreedy() {
  const { gridW, gridH, treasureW, treasureH, targetPct } = clampInputs();
  const placements = allPlacements(gridW, gridH, treasureW, treasureH);
  const need = targetNeeded(placements, targetPct);
  if (coveredPlacements(selected, placements) >= need) return;

  const uncovered = new Set();
  for (let i = 0; i < placements.length; i++) {
    if (!placements[i].cells.some(cell => selected.has(cell))) uncovered.add(i);
  }

  const cellToPlacements = buildCellToPlacements(placements);
  const bestCell = chooseBestCell(cellToPlacements, uncovered, selected, treasureW, treasureH);

  if (bestCell) {
    selected.add(bestCell);
    lastStepPick = bestCell;
    lastExactStatus = "";
    cachedOptimalSignature = "";
    cachedOptimalSolution = [];
    render();
  }
}

function compareModes() {
  const { gridW, gridH, treasureW, treasureH, targetPct } = clampInputs();
  const placements = allPlacements(gridW, gridH, treasureW, treasureH);

  const rows = [];
  const exact = solveExactOptimal();
  rows.push(formatComparison("Exact optimal", exact, placements));

  if (targetPct === 100) {
    const pretty = solvePrettyGuarantee(gridW, gridH, treasureW, treasureH);
    rows.push(formatComparison("Pretty guarantee", pretty, placements));
  }

  const greedy = solveGreedySet();
  rows.push(formatComparison("Greedy fast", greedy, placements));

  const random = solveRandomSample();
  rows.push(formatComparison("Random sample", random, placements));

  compareText.textContent = rows.join("\n");
  lastExactStatus = "";
  updateStats();
}

function formatComparison(name, set, placements) {
  const covered = coveredPlacements(set, placements);
  const pct = (covered / placements.length * 100).toFixed(2);
  const coords = [...set]
    .map(parseKey)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([r, c]) => `(${r + 1},${c + 1})`)
    .join(" ");

  return `${name}\nClicks: ${set.size}\nCoverage: ${covered}/${placements.length} = ${pct}%\n${coords}\n`;
}

document.getElementById("buildBtn").addEventListener("click", () => {
  selected.clear();
  lastStepPick = null;
  lastExactStatus = "";
  cachedOptimalSignature = "";
  cachedOptimalSolution = [];
  render();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  selected.clear();
  lastStepPick = null;
  lastExactStatus = "";
  cachedOptimalSignature = "";
  cachedOptimalSolution = [];
  render();
});

document.getElementById("solveBtn").addEventListener("click", solvePattern);
document.getElementById("stepBtn").addEventListener("click", stepMode);
document.getElementById("compareBtn").addEventListener("click", compareModes);

document.getElementById("copyBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(patternText.textContent);
  const btn = document.getElementById("copyBtn");
  const old = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => btn.textContent = old, 900);
});

for (const input of [gridWInput, gridHInput, treasureWInput, treasureHInput, targetPctInput, solverModeInput, showCoverageInput]) {
  input.addEventListener("change", () => {
    lastExactStatus = "";
    cachedOptimalSignature = "";
    cachedOptimalSolution = [];
    render();
  });
}

window.addEventListener("resize", renderCoverageOverlay);
render();
