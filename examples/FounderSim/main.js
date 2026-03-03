// FounderSim - 简易 Web 创业模拟器

const $ = (id) => document.getElementById(id);

const elements = {
  setupPanel: $("setup-panel"),
  gamePanel: $("game-panel"),
  helpPanel: $("help-panel"),
  startBtn: $("start-game-btn"),
  restartBtn: $("restart-btn"),
  nextMonthBtn: $("next-month-btn"),
  fastForwardBtn: $("fast-forward-btn"),
  founderName: $("founder-name"),
  startupName: $("startup-name"),
  domain: $("startup-domain"),
  companyTitle: $("company-title"),
  companySubtitle: $("company-subtitle"),
  monthLabel: $("month-label"),
  stageLabel: $("stage-label"),
  cashStat: $("cash-stat"),
  burnRateStat: $("burn-rate-stat"),
  usersStat: $("users-stat"),
  growthRateStat: $("growth-rate-stat"),
  productStat: $("product-stat"),
  pmfStat: $("pmf-stat"),
  teamMoraleStat: $("team-morale-stat"),
  brandStat: $("brand-stat"),
  logContainer: $("log-container"),
  themeToggle: $("toggle-theme-btn"),
};

const dom = {
  formatMoney(value) {
    if (value >= 100000000) return (value / 100000000).toFixed(1) + " 亿";
    if (value >= 10000) return (value / 10000).toFixed(1) + " 万";
    return value.toFixed(0);
  },
  formatPercent(value) {
    return `${value.toFixed(0)}%`;
  },
  formatUsers(value) {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + " M";
    if (value >= 10000) return (value / 10000).toFixed(1) + " 万";
    return value.toFixed(0);
  },
};

const INITIAL_STATE = {
  month: 1,
  maxMonths: 36,
  cash: 400 * 10000,
  burnRate: -60 * 10000,
  users: 200,
  userGrowth: 0,
  productProgress: 20,
  pmf: 5,
  teamMorale: 60,
  brand: 10,
  valuation: 0,
  stage: "种子轮探索期",
  lastAction: null,
  selectedAction: null,
  isGameOver: false,
};

let game = {
  ...INITIAL_STATE,
  founderName: "",
  startupName: "",
  domain: "saas",
  strategy: "balanced",
};

function cloneState() {
  return { ...game };
}

function applyDomainModifiers(state) {
  switch (state.domain) {
    case "saas":
      state.burnRate -= 10 * 10000;
      state.productProgress += 3;
      break;
    case "consumer":
      state.userGrowth += 4;
      state.burnRate -= 15 * 10000;
      break;
    case "ai":
      state.burnRate -= 20 * 10000;
      state.productProgress += 6;
      state.pmf += 2;
      break;
    case "game":
      state.userGrowth += 2;
      state.brand += 5;
      break;
    case "fintech":
      state.productProgress += 4;
      state.brand += 3;
      break;
  }
}

function applyStrategyModifiers(state) {
  switch (state.strategy) {
    case "growth":
      state.userGrowth += 6;
      state.burnRate -= 15 * 10000;
      break;
    case "product":
      state.productProgress += 8;
      state.pmf += 4;
      state.userGrowth -= 2;
      break;
    case "balanced":
    default:
      state.userGrowth += 2;
      state.productProgress += 3;
      break;
  }
}

const random = {
  between(min, max) {
    return Math.random() * (max - min) + min;
  },
  int(min, max) {
    return Math.floor(this.between(min, max + 1));
  },
  chance(prob) {
    return Math.random() < prob;
  },
};

function pushLog({ text, tone = "neutral", tag }) {
  const entry = document.createElement("div");
  entry.className = `log-entry ${tone}`;

  const meta = document.createElement("div");
  meta.className = "log-meta";
  meta.innerHTML = `<span>第 ${game.month} 个月</span><span>${tag || ""}</span>`;

  const body = document.createElement("div");
  body.className = "log-text";
  body.textContent = text;

  entry.appendChild(meta);
  entry.appendChild(body);
  elements.logContainer.prepend(entry);
}

function getStageLabel(state) {
  if (state.month <= 6) return "种子轮探索期";
  if (state.month <= 12) return "天使轮验证期";
  if (state.month <= 24) return "A/B 轮扩张期";
  if (state.month <= 36) return "冲刺独角兽";
  return "未知阶段";
}

function estimateValuation(state) {
  const revenueMultiple = 8 + state.pmf / 10 + state.brand / 20;
  const activeUsersFactor = Math.log10(Math.max(state.users, 10));
  const pmfMultiplier = 0.3 + state.pmf / 100;

  const annualRevenue = Math.max(-state.burnRate * 12, 0);
  const baseValuation =
    annualRevenue * revenueMultiple * pmfMultiplier * activeUsersFactor;
  const riskFactor =
    0.7 +
    (state.teamMorale - 50) / 200 +
    (state.brand - 30) / 300 +
    (state.cash / (12 * Math.abs(state.burnRate) + 1));

  const valuation = baseValuation * riskFactor;
  return Math.max(valuation, 0);
}

function updateStatsView() {
  elements.monthLabel.textContent = `第 ${game.month} / ${game.maxMonths} 个月`;
  game.stage = getStageLabel(game);
  elements.stageLabel.textContent = game.stage;

  elements.cashStat.textContent = dom.formatMoney(game.cash) + " 元";
  const burnAbs = Math.abs(game.burnRate);
  const burnText =
    (game.burnRate < 0 ? "-" : "+") +
    dom.formatMoney(burnAbs) +
    " / 月 现金流";
  elements.burnRateStat.textContent = burnText;

  elements.usersStat.textContent = dom.formatUsers(game.users);
  const growthSign = game.userGrowth >= 0 ? "+" : "";
  elements.growthRateStat.textContent =
    growthSign + game.userGrowth.toFixed(1) + "% / 月 增速";

  elements.productStat.textContent = dom.formatPercent(
    Math.min(game.productProgress, 120)
  );
  elements.pmfStat.textContent =
    "PMF 匹配度 " + dom.formatPercent(Math.min(game.pmf, 120));

  elements.teamMoraleStat.textContent = dom.formatPercent(
    Math.min(game.teamMorale, 120)
  );
  elements.brandStat.textContent = "品牌 / 口碑 " + dom.formatPercent(game.brand);
}

function selectAction(key) {
  const buttons = document.querySelectorAll(".action-btn");
  buttons.forEach((btn) => {
    const action = btn.getAttribute("data-action");
    btn.classList.toggle("selected", action === key);
  });
  game.selectedAction = key;
}

const actions = {
  build(state) {
    const base = random.int(8, 16);
    const pmfBoost = random.int(3, 8);
    state.productProgress += base;
    state.pmf += pmfBoost;
    state.userGrowth -= random.between(0.5, 2);
    state.burnRate -= 6 * 10000;
    state.teamMorale += random.int(-2, 4);

    pushLog({
      text: `你专注打磨产品，迭代了几个关键功能，产品进度 +${base.toFixed(
        0
      )}，PMF +${pmfBoost.toFixed(0)}。`,
      tone: "positive",
      tag: "打磨产品",
    });
  },
  growth(state) {
    const growthBase = random.between(6, 18);
    state.userGrowth += growthBase;
    const extraUsers =
      state.users * (growthBase / 100) +
      random.between(100, 2000) * (1 + state.pmf / 100);
    state.users += extraUsers;
    state.burnRate -= random.int(10, 25) * 10000;
    state.productProgress += random.int(-2, 3);
    state.teamMorale += random.int(-3, 3);
    state.brand += random.int(2, 6);

    pushLog({
      text: `你大力投放和运营，本月获得约 ${dom.formatUsers(
        extraUsers
      )} 新增用户，品牌曝光度提升。`,
      tone: "positive",
      tag: "增长获客",
    });
  },
  fundraise(state) {
    const baseChance = 0.18;
    const pmfBonus = state.pmf / 150;
    const brandBonus = state.brand / 200;
    const moraleBonus = (state.teamMorale - 50) / 300;
    const totalChance = baseChance + pmfBonus + brandBonus + moraleBonus;

    if (random.chance(totalChance)) {
      const preValuation = estimateValuation(state);
      const multiple = random.between(0.25, 0.5);
      const raiseAmount = preValuation * multiple || 800 * 10000;
      state.cash += raiseAmount;
      state.brand += 8;
      state.teamMorale += 10;
      state.burnRate -= random.int(5, 15) * 10000;

      pushLog({
        text: `融资成功！本轮获得约 ${dom.formatMoney(
          raiseAmount
        )} 元投资，估值随之提升，团队士气大涨。`,
        tone: "positive",
        tag: "融资成功",
      });
    } else {
      state.teamMorale -= random.int(4, 10);
      state.brand += random.int(0, 4);

      pushLog({
        text: "多轮路演后，并未拿到 term sheet，团队略显疲惫，但也获得了不少市场反馈。",
        tone: "neutral",
        tag: "融资受阻",
      });
    }
  },
  hire(state) {
    const moraleGain = random.int(8, 18);
    state.teamMorale += moraleGain;
    state.productProgress += random.int(2, 6);
    state.brand += random.int(1, 4);
    state.burnRate -= random.int(8, 18) * 10000;

    pushLog({
      text: `你招到了几位关键岗位的靠谱同事，团队士气 +${moraleGain}，整体战斗力提升。`,
      tone: "positive",
      tag: "招兵买马",
    });
  },
  optimize(state) {
    const burnImprove = random.int(10, 25) * 10000;
    state.burnRate += burnImprove;
    state.userGrowth -= random.between(2, 6);
    state.pmf += random.int(2, 6);
    state.brand += random.int(1, 3);

    pushLog({
      text: `你精细化打磨留存与成本结构，本月降本增效 ${dom.formatMoney(
        burnImprove
      )} 元 / 月，PMF 略有提升。`,
      tone: "positive",
      tag: "精细运营",
    });
  },
  pivot(state) {
    if (!random.chance(0.35)) {
      state.productProgress -= random.int(5, 15);
      state.pmf -= random.int(5, 12);
      state.teamMorale -= random.int(6, 15);
      state.brand -= random.int(3, 8);

      pushLog({
        text: "你尝试转型 Pivot，但市场反应平平，团队也有些迷茫。短期内数据表现下滑。",
        tone: "negative",
        tag: "Pivot 受挫",
      });
      return;
    }

    const boost = random.int(10, 25);
    state.pmf += boost;
    state.productProgress += random.int(8, 18);
    state.userGrowth += random.between(8, 20);
    state.brand += random.int(6, 15);
    state.teamMorale += random.int(8, 16);
    state.burnRate -= random.int(5, 12) * 10000;

    pushLog({
      text: `一次大胆的 Pivot 成功踩中了更大的需求空间，PMF +${boost}，增长曲线开始明显变陡。`,
      tone: "positive",
      tag: "Pivot 成功",
    });
  },
};

function triggerRandomEvent(state) {
  const baseProb = 0.18;
  let prob = baseProb;

  if (state.teamMorale < 40) prob += 0.08;
  if (state.brand < 20) prob += 0.05;
  if (state.pmf > 60) prob -= 0.05;

  if (!random.chance(prob)) return;

  const isPositive = random.chance(
    0.45 + state.teamMorale / 200 + state.brand / 200
  );

  if (isPositive) {
    const events = [
      () => {
        const users = random.int(3000, 12000);
        state.users += users;
        state.brand += 8;
        pushLog({
          text: `一个核心用户在社交媒体自来水安利，带来了约 ${dom.formatUsers(
            users
          )} 新增用户，品牌口碑大幅提升。`,
          tone: "positive",
          tag: "自来水传播",
        });
      },
      () => {
        const pmfGain = random.int(6, 15);
        state.pmf += pmfGain;
        state.productProgress += random.int(4, 10);
        pushLog({
          text: `你们和几个重要客户深度共创，产品一下子更贴近真实业务场景，PMF +${pmfGain}。`,
          tone: "positive",
          tag: "共创迭代",
        });
      },
      () => {
        const burnImprove = random.int(8, 18) * 10000;
        state.burnRate += burnImprove;
        state.teamMorale += random.int(4, 10);
        pushLog({
          text: `通过重构架构 + 优化采购，你们成功优化了成本结构，月度烧钱减少 ${dom.formatMoney(
            burnImprove
          )} 元。`,
          tone: "positive",
          tag: "成本优化",
        });
      },
    ];
    const idx = random.int(0, events.length - 1);
    events[idx]();
  } else {
    const events = [
      () => {
        const usersLost = random.int(2000, 8000);
        state.users = Math.max(0, state.users - usersLost);
        state.brand -= random.int(6, 14);
        pushLog({
          text: `一次严重的线上事故导致服务中断，多名核心客户流失，约 ${dom.formatUsers(
            usersLost
          )} 用户离开，品牌口碑受损。`,
          tone: "negative",
          tag: "线上事故",
        });
      },
      () => {
        state.teamMorale -= random.int(10, 20);
        state.productProgress -= random.int(4, 10);
        pushLog({
          text: "团队内部出现分歧，核心成员对方向产生争议，一段时间内执行力明显下滑。",
          tone: "negative",
          tag: "团队波动",
        });
      },
      () => {
        const burnWorse = random.int(10, 20) * 10000;
        state.burnRate -= burnWorse;
        pushLog({
          text: `宏观环境突变，成本端集体上升，你们的月度烧钱被动增加 ${dom.formatMoney(
            burnWorse
          )} 元。`,
          tone: "negative",
          tag: "外部环境",
        });
      },
    ];
    const idx = random.int(0, events.length - 1);
    events[idx]();
  }
}

function applyEndOfMonth(state) {
  state.cash += state.burnRate;

  const baseOrganic = 1 + state.pmf / 40 + state.brand / 60;
  state.userGrowth += random.between(-1.5, 1.5);
  const totalGrowthRate = Math.max(state.userGrowth + baseOrganic, -15);

  if (state.users > 0) {
    const delta = (state.users * totalGrowthRate) / 100;
    state.users = Math.max(0, state.users + delta);
  }

  if (state.productProgress > 100 && state.pmf < 90) {
    state.pmf += random.int(0, 3);
  }

  state.teamMorale += random.int(-3, 2);

  state.productProgress = Math.max(0, Math.min(state.productProgress, 130));
  state.pmf = Math.max(0, Math.min(state.pmf, 130));
  state.teamMorale = Math.max(0, Math.min(state.teamMorale, 130));
  state.brand = Math.max(0, Math.min(state.brand, 130));
}

function checkGameOver(state) {
  if (state.cash <= 0) {
    pushLog({
      text: "现金流断裂，公司进入破产清算流程。你们的故事暂时告一段落。",
      tone: "negative",
      tag: "游戏结束",
    });
    return {
      over: true,
      ending: "cash_out",
    };
  }

  if (state.month >= state.maxMonths) {
    const valuation = estimateValuation(state);
    const isUnicorn = valuation >= 10 * 100000000;
    const hasPMF = state.pmf >= 70 && state.productProgress >= 80;

    if (isUnicorn && hasPMF) {
      pushLog({
        text: `你们在 36 个月内成功打造出了真正的产品市场匹配，并达成约 ${dom.formatMoney(
          valuation
        )} 元估值的「准独角兽」。这只是更大旅程的开始。`,
        tone: "positive",
        tag: "高光时刻",
      });
      return { over: true, ending: "unicorn" };
    }

    if (hasPMF) {
      pushLog({
        text: "你们找到了稳定的产品市场匹配，但暂未完成爆发式增长。或许再给你们一点时间，就可以见证奇迹。",
        tone: "neutral",
        tag: "阶段性成功",
      });
      return { over: true, ending: "pmf" };
    }

    pushLog({
      text: "时间走到了第 36 个月，公司还在，但商业模式仍未完全跑通。你们收获了大量经验，也付出了不小代价。",
      tone: "neutral",
      tag: "探索未完",
    });
    return { over: true, ending: "survive" };
  }

  if (state.teamMorale <= 5) {
    pushLog({
      text: "连续的压力和不确定性让团队几近崩溃，核心成员相继离开，公司陷入停摆。",
      tone: "negative",
      tag: "团队解散",
    });
    return { over: true, ending: "team" };
  }

  if (state.users <= 0 && state.pmf < 20 && state.month > 18) {
    pushLog({
      text: "经过长期探索，你们没有找到足够规模的真实需求。理性止损，选择体面收场。",
      tone: "negative",
      tag: "理性止损",
    });
    return { over: true, ending: "no_pmf" };
  }

  return { over: false };
}

function nextMonth() {
  if (game.isGameOver) return;

  const actionKey = game.selectedAction;
  if (!actionKey || !actions[actionKey]) {
    alert("请先在「本月你要怎么做？」里选择一个主要行动。");
    return;
  }

  const state = cloneState();

  switch (actionKey) {
    case "build":
      actions.build(state);
      break;
    case "growth":
      actions.growth(state);
      break;
    case "fundraise":
      actions.fundraise(state);
      break;
    case "hire":
      actions.hire(state);
      break;
    case "optimize":
      actions.optimize(state);
      break;
    case "pivot":
      actions.pivot(state);
      break;
    default:
      break;
  }

  applyDomainModifiers(state);
  applyStrategyModifiers(state);

  applyEndOfMonth(state);
  triggerRandomEvent(state);

  state.month += 1;
  game = { ...game, ...state, lastAction: actionKey };

  const { over } = checkGameOver(game);
  if (over) {
    game.isGameOver = true;
    elements.nextMonthBtn.disabled = true;
    elements.fastForwardBtn.disabled = true;
  }

  updateStatsView();
}

function fastForward(months) {
  for (let i = 0; i < months; i += 1) {
    if (game.isGameOver) break;
    nextMonth();
  }
}

function resetGame() {
  const strategy = document.querySelector(
    'input[name="strategy"]:checked'
  )?.value;

  game = {
    ...INITIAL_STATE,
    founderName: elements.founderName.value.trim() || "匿名创始人",
    startupName: elements.startupName.value.trim() || "未命名公司",
    domain: elements.domain.value,
    strategy: strategy || "balanced",
  };

  elements.companyTitle.textContent = game.startupName;
  elements.companySubtitle.textContent = `${game.founderName} · ${
    elements.domain.options[elements.domain.selectedIndex].text
  }`;

  elements.setupPanel.classList.add("hidden");
  elements.gamePanel.classList.remove("hidden");

  elements.logContainer.innerHTML = "";
  elements.nextMonthBtn.disabled = false;
  elements.fastForwardBtn.disabled = false;

  pushLog({
    text: `你以「${game.startupName}」的名义正式开始创业旅程，当前战略倾向：${{
      balanced: "稳健均衡",
      growth: "激进增长",
      product: "产品至上",
    }[game.strategy]}。`,
    tone: "neutral",
    tag: "旅程开始",
  });

  updateStatsView();
}

function hardRestart() {
  game = {
    ...INITIAL_STATE,
    founderName: "",
    startupName: "",
    domain: "saas",
    strategy: "balanced",
    isGameOver: false,
  };
  elements.setupPanel.classList.remove("hidden");
  elements.gamePanel.classList.add("hidden");
  elements.logContainer.innerHTML = "";
  elements.founderName.value = "";
  elements.startupName.value = "";
  elements.domain.value = "saas";
  const btns = document.querySelectorAll(".action-btn");
  btns.forEach((b) => b.classList.remove("selected"));
  game.selectedAction = null;
}

function initTheme() {
  const saved = localStorage.getItem("foundersim-theme");
  if (saved === "light") {
    document.body.classList.add("light");
  }
  elements.themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    localStorage.setItem("foundersim-theme", isLight ? "light" : "dark");
  });
}

function initActions() {
  const buttons = document.querySelectorAll(".action-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-action");
      selectAction(key);
    });
  });

  elements.nextMonthBtn.addEventListener("click", () => nextMonth());
  elements.fastForwardBtn.addEventListener("click", () => fastForward(3));
  elements.restartBtn.addEventListener("click", () => hardRestart());

  elements.startBtn.addEventListener("click", () => resetGame());
}

function init() {
  initTheme();
  initActions();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

