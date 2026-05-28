const config = {
  days: 30,
  dailyDemandMean: 1000,
  energyCostPerKwh: 150,
};

const factory = {
  name: "기준 공장",
  transportCost: 1000,
  supplierDelayMean: 1.0,
  processRate: 1000,
  defectRate: 0.03,
  uptime: 0.95,
  fixedCost: 800000,
  variableCost: 6500,
  pricePerUnit: 11000,
};

const referenceRobot = {
  speed: 60,
  precision: 0.1,
  payload: 10,
  failureRate: 0.03,
  maintenanceTime: 1.0,
  energyPerDay: 100,
  investmentPerDay: 150000,
};

const fields = [
  "speed",
  "precision",
  "payload",
  "failureRate",
  "maintenanceTime",
  "energyPerDay",
  "investmentPerDay",
];

const fieldLimits = {
  speed: { min: 20, max: 120, fallback: 60 },
  precision: { min: 0.01, max: 0.3, fallback: 0.1 },
  payload: { min: 1, max: 30, fallback: 10 },
  failureRate: { min: 0, max: 0.3, fallback: 0.03 },
  maintenanceTime: { min: 0, max: 8, fallback: 1 },
  energyPerDay: { min: 20, max: 300, fallback: 100 },
  investmentPerDay: { min: 50000, max: 500000, fallback: 150000 },
};

const scoreColors = ["#3a9b5f", "#d79922", "#52616d"];
const scoreLabels = ["효율 점수", "경제성 점수", "종합 점수"];

const wonFormatter = new Intl.NumberFormat("ko-KR");

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

function safeNumber(value, field) {
  const limit = fieldLimits[field];
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return limit.fallback;
  }

  return clamp(number, limit.min, limit.max);
}

function normalizeRobot(robot) {
  return Object.fromEntries(
    fields.map((field) => [field, safeNumber(robot[field], field)]),
  );
}

function createRng(seed) {
  let state = seed >>> 0;
  let spare = null;

  function uniform() {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) + 0.5) / 4294967296;
  }

  return {
    gaussian() {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return value;
      }

      const u = Math.max(uniform(), Number.EPSILON);
      const v = uniform();
      const radius = Math.sqrt(-2 * Math.log(u));
      const angle = 2 * Math.PI * v;
      spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    },
  };
}

function adjustFactory(robot) {
  robot = normalizeRobot(robot);

  const speedFactor = clamp(
    1 + 0.25 * ((robot.speed - referenceRobot.speed) / referenceRobot.speed),
    0.8,
    1.4,
  );

  const precisionFactor = clamp(referenceRobot.precision / Math.max(robot.precision, 0.001), 0.5, 2.0);
  const payloadFactor = clamp(
    1 + 0.1 * ((robot.payload - referenceRobot.payload) / referenceRobot.payload),
    0.85,
    1.25,
  );
  const maintenanceFactor = clamp(1 - robot.maintenanceTime / 24, 0.6, 1.0);
  const failureFactor = clamp(1 - robot.failureRate, 0.7, 1.0);

  const processRate = factory.processRate * speedFactor * payloadFactor * maintenanceFactor;
  const defectRate = clamp(factory.defectRate * (1 / precisionFactor), 0.001, 0.2);
  const uptime = clamp(factory.uptime * failureFactor * maintenanceFactor, 0.6, 0.999);
  const fixedCost = factory.fixedCost + robot.investmentPerDay + robot.energyPerDay * config.energyCostPerKwh;

  return {
    processRate,
    defectRate,
    uptime,
    fixedCost,
    speedFactor,
    precisionFactor,
    payloadFactor,
    maintenanceFactor,
    failureFactor,
  };
}

function runSimulation(adjusted, seed = 1) {
  const rng = createRng(seed);
  const dailyProfit = [];
  const dailyProduced = [];

  let totalProduced = 0;
  let totalGoodUnits = 0;
  let totalSold = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  let totalDemand = 0;

  for (let day = 0; day < config.days; day += 1) {
    const demand = Math.max(0, Math.round(config.dailyDemandMean + 100 * rng.gaussian()));
    totalDemand += demand;

    const supplierDelay = Math.max(0, factory.supplierDelayMean + 0.2 * rng.gaussian());
    const delayFactor = Math.max(0.7, 1 - 0.08 * supplierDelay);

    const actualUptime = clamp(adjusted.uptime + 0.02 * rng.gaussian(), 0.55, 1.0);
    const produced = Math.round(adjusted.processRate * actualUptime * delayFactor);

    const actualDefectRate = clamp(adjusted.defectRate + 0.003 * rng.gaussian(), 0.0, 0.2);
    const goodUnits = Math.round(produced * (1 - actualDefectRate));
    const sold = Math.min(goodUnits, demand);

    const revenue = sold * factory.pricePerUnit;
    const variableCostToday = produced * factory.variableCost;
    const logisticsCost = sold * factory.transportCost;
    const unmetDemand = Math.max(0, demand - sold);
    const delayPenalty = unmetDemand * 1000;
    const cost = adjusted.fixedCost + variableCostToday + logisticsCost + delayPenalty;
    const profit = revenue - cost;

    totalProduced += produced;
    totalGoodUnits += goodUnits;
    totalSold += sold;
    totalRevenue += revenue;
    totalCost += cost;
    dailyProfit.push(profit);
    dailyProduced.push(produced);
  }

  return {
    totalProduced,
    totalGoodUnits,
    totalSold,
    totalRevenue,
    totalCost,
    totalDemand,
    dailyProfit,
    dailyProduced,
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function calculateMetrics(result) {
  const totalProfit = result.totalRevenue - result.totalCost;

  return {
    avgProduced: average(result.dailyProduced),
    serviceLevel: result.totalSold / Math.max(result.totalDemand, 1),
    yieldRate: result.totalGoodUnits / Math.max(result.totalProduced, 1),
    totalProfit,
    avgProfit: average(result.dailyProfit),
    unitProfit: totalProfit / Math.max(result.totalSold, 1),
  };
}

function calculateScores(adjusted, metrics, refAdjusted, refMetrics) {
  const efficiency = 100 * (
    0.30 * (metrics.avgProduced / refMetrics.avgProduced)
    + 0.25 * (metrics.yieldRate / refMetrics.yieldRate)
    + 0.25 * (metrics.serviceLevel / refMetrics.serviceLevel)
    + 0.20 * (adjusted.uptime / refAdjusted.uptime)
  );

  const economy = 100 * (
    0.40 * (metrics.totalProfit / refMetrics.totalProfit)
    + 0.30 * (metrics.avgProfit / refMetrics.avgProfit)
    + 0.20 * (metrics.unitProfit / refMetrics.unitProfit)
    + 0.10 * (refAdjusted.fixedCost / adjusted.fixedCost)
  );

  const automationBase =
    0.30 * adjusted.speedFactor
    + 0.25 * (adjusted.precisionFactor / 2)
    + 0.20 * adjusted.payloadFactor
    + 0.25 * adjusted.failureFactor;

  const automationLevel = clamp(automationBase - 0.5, 0, 1);
  let weightEfficiency = 0.40 + 0.12 * automationLevel;
  let weightEconomy = 0.30 - 0.04 * automationLevel;
  const weightSum = weightEfficiency + weightEconomy;

  weightEfficiency /= weightSum;
  weightEconomy /= weightSum;

  const baseTotal = weightEfficiency * efficiency + weightEconomy * economy;
  const reliabilityPenalty = clamp(adjusted.failureFactor / refAdjusted.failureFactor, 0.72, 1.04);
  const maintenancePenalty = clamp(adjusted.maintenanceFactor / refAdjusted.maintenanceFactor, 0.72, 1.04);
  const total = baseTotal * reliabilityPenalty * maintenancePenalty;

  return {
    efficiency,
    economy,
    total,
    weights: [weightEfficiency, weightEconomy],
  };
}

function getRobotFromForm() {
  return normalizeRobot(Object.fromEntries(
    fields.map((field) => [field, Number(document.getElementById(field).value)]),
  ));
}

function evaluateRobot(robot) {
  const adjusted = adjustFactory(robot);
  const refAdjusted = adjustFactory(referenceRobot);
  const result = runSimulation(adjusted, 1);
  const refResult = runSimulation(refAdjusted, 1);
  const metrics = calculateMetrics(result);
  const refMetrics = calculateMetrics(refResult);
  const scores = calculateScores(adjusted, metrics, refAdjusted, refMetrics);

  return { adjusted, metrics, scores };
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function renderChart(scores) {
  const values = [scores.efficiency, scores.economy, scores.total];
  const maxValue = Math.max(120, ...values.map((value) => Math.max(0, value))) * 1.08;
  const chart = document.getElementById("barChart");
  chart.innerHTML = "";

  const barsArea = document.createElement("div");
  barsArea.className = "bars-area";
  barsArea.style.setProperty("--reference-bottom", `${(100 / maxValue) * 100}%`);
  const referenceLine = document.createElement("div");
  referenceLine.className = "reference-line";
  referenceLine.innerHTML = "<span>기준 100</span>";
  barsArea.appendChild(referenceLine);

  const labelsArea = document.createElement("div");
  labelsArea.className = "chart-labels";

  values.forEach((value, index) => {
    const height = `${(Math.max(0, value) / maxValue) * 100}%`;
    const bar = document.createElement("div");
    bar.className = "bar-column";
    bar.style.setProperty("--bar-height", height);
    bar.innerHTML = `
      <span class="bar-value">${value.toFixed(1)}</span>
      <div class="bar-fill" style="height: ${height}; --bar-color: ${scoreColors[index]}"></div>
    `;
    barsArea.appendChild(bar);

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = scoreLabels[index];
    labelsArea.appendChild(label);
  });

  chart.appendChild(barsArea);
  chart.appendChild(labelsArea);
}

function renderResult(result) {
  const { adjusted, metrics, scores } = result;

  setText("totalScore", scores.total.toFixed(2));
  setText("scoreMessage", scores.total > 100 ? "기준보다 우수" : scores.total < 100 ? "기준보다 미흡" : "기준 공장 수준");
  setText("serviceLevel", `${(metrics.serviceLevel * 100).toFixed(2)}%`);
  setText("yieldRate", `${(metrics.yieldRate * 100).toFixed(2)}%`);
  setText("totalProfit", `${wonFormatter.format(Math.round(metrics.totalProfit))}원`);
  setText("adjustedProcessRate", adjusted.processRate.toFixed(2));
  setText("adjustedDefectRate", adjusted.defectRate.toFixed(4));
  setText("adjustedUptime", adjusted.uptime.toFixed(4));
  setText("unitProfit", `${wonFormatter.format(metrics.unitProfit.toFixed(2))}원`);
  setText("weights", scores.weights.map((weight) => weight.toFixed(3)).join(" / "));

  renderChart(scores);
}

function updateRobotPreview() {
  const robot = getRobotFromForm();
  const result = evaluateRobot(robot);
  setText("liveTotal", result.scores.total.toFixed(2));
}

function bindSyncedInputs() {
  document.querySelectorAll("[data-sync]").forEach((range) => {
    const number = document.getElementById(range.dataset.sync);

    range.addEventListener("input", () => {
      number.value = range.value;
      updateRobotPreview();
    });

    number.addEventListener("input", () => {
      const value = safeNumber(number.value, range.dataset.sync);
      number.value = value;
      range.value = value;
      updateRobotPreview();
    });
  });
}

function resetToReference() {
  Object.entries(referenceRobot).forEach(([key, value]) => {
    const input = document.getElementById(key);
    const range = document.querySelector(`[data-sync="${key}"]`);
    input.value = value;
    range.value = value;
  });
  updateRobotPreview();
}

document.getElementById("robotForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const result = evaluateRobot(getRobotFromForm());
  renderResult(result);
  document.getElementById("inputScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.remove("hidden");
});

document.getElementById("backButton").addEventListener("click", () => {
  document.getElementById("resultScreen").classList.add("hidden");
  document.getElementById("inputScreen").classList.remove("hidden");
  updateRobotPreview();
});

document.getElementById("resetButton").addEventListener("click", resetToReference);

bindSyncedInputs();
updateRobotPreview();
