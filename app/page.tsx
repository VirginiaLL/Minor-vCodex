"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Wish = {
  id: number;
  text: string;
};

type LetGoReason = "not-now" | "not-really" | "borrowed" | "duel";
type WallpaperTheme = "quiet" | "warm" | "firm" | "paper" | "signal";
type TimeHorizon = "monthly" | "quarterly" | "yearly";

type DiscardedWish = Wish & {
  reason: LetGoReason;
  discardedAt: string;
  revisitAt?: string;
};

type MonthlyWish = Wish & {
  done: boolean;
  resolution?: "carried" | "pooled" | "released";
};

type CycleRecord = {
  cycleKey: string;
  periodStamp: string;
  horizon: TimeHorizon;
  savedAt: string;
  theme: WallpaperTheme;
  wishes: MonthlyWish[];
};

type WishCoin = Wish & {
  coinId: string;
  completedAt: string;
  periodStamp: string;
  horizon: TimeHorizon;
};

type PersistedState = {
  wishes: Wish[];
  discarded: DiscardedWish[];
  theme: WallpaperTheme;
  timeHorizon: TimeHorizon;
  history: CycleRecord[];
  coins: WishCoin[];
  hasEnumerated: boolean;
};

const STORAGE_KEY = "minor:v2";

const starterWishes: Wish[] = [
  { id: 1, text: "给妈妈打个电话" },
  { id: 2, text: "学会冲浪" },
  { id: 3, text: "启动自己的播客" },
  { id: 4, text: "读完床头那本书" },
  { id: 5, text: "去冰岛看极光" },
  { id: 6, text: "整理过去五年的相册" },
  { id: 7, text: "学做一道拿手菜" },
  { id: 8, text: "每周留半天给自己" },
];

const inspirationGroups = [
  {
    title: "身体与生活",
    note: "让日常变得更有生命力",
    items: ["连续早睡一个月", "每周运动三次", "学会一道拿手菜", "做一次全面体检", "养成每天散步的习惯"],
  },
  {
    title: "关系与爱",
    note: "把时间留给真正重要的人",
    items: ["和父母旅行一次", "给重要的人写一封信", "每周给家人打电话", "认真认识一个新朋友", "组织一次老友聚会"],
  },
  {
    title: "创造与成长",
    note: "做出只属于自己的东西",
    items: ["学会一门新语言", "完成自己的作品集", "开始稳定地写作", "做出副业的第一单", "启动一个自己的播客"],
  },
  {
    title: "体验世界",
    note: "去生活之外看一看",
    items: ["独自旅行一次", "去看一次极光", "体验一次潜水", "去喜欢的音乐节", "在陌生城市住一个月"],
  },
];

const inspirationItemBatches = [
  inspirationGroups.map((group) => group.items),
  [
    ["学会游泳", "认真吃一顿早餐", "恢复一项喜欢的运动", "周末去郊外走走", "每天少刷半小时手机"],
    ["和父母拍一张合照", "约很久没见的朋友吃饭", "认真说一次谢谢", "陪家人过一个完整周末", "为喜欢的人准备一份礼物"],
    ["写完一个短篇故事", "做一本自己的小刊物", "学习摄影", "完成一件手工作品", "把一个想法做成产品"],
    ["去海边住几天", "看一次日出", "坐火车去一个陌生小城", "去现场看一场球赛", "在山里徒步一天"],
  ],
  [
    ["固定时间睡觉", "学会做三道家常菜", "开始力量训练", "给房间做一次断舍离", "每个月安排一天独处"],
    ["带父母重新看看故乡", "和伴侣完成一次长途旅行", "给老朋友寄一张明信片", "认真修复一段关系", "认识住在附近的人"],
    ["学会一种乐器", "公开发布第一篇作品", "建立个人网站", "参加一次公开分享", "完成一直拖着的课程"],
    ["去沙漠看星星", "尝试一次露营", "去博物馆待一整天", "在喜欢的城市生活一周", "看一场期待很久的演出"],
  ],
];

const timeHorizonOptions: Array<{ id: TimeHorizon; label: string; note: string }> = [
  { id: "monthly", label: "月度", note: "接下来的一个月" },
  { id: "quarterly", label: "季度", note: "接下来的三个月" },
  { id: "yearly", label: "年度", note: "接下来的一年" },
];

const bubbleLayouts = [
  { x: 7, y: 8, size: 136, delay: "-2s" },
  { x: 36, y: 2, size: 158, delay: "-5s" },
  { x: 70, y: 10, size: 124, delay: "-1s" },
  { x: 19, y: 38, size: 116, delay: "-7s" },
  { x: 53, y: 34, size: 146, delay: "-4s" },
  { x: 81, y: 43, size: 112, delay: "-3s" },
  { x: 4, y: 66, size: 126, delay: "-6s" },
  { x: 35, y: 67, size: 120, delay: "-2.5s" },
  { x: 68, y: 71, size: 132, delay: "-8s" },
  { x: 16, y: 16, size: 128, delay: "-3.5s" },
  { x: 48, y: 9, size: 116, delay: "-6.5s" },
  { x: 78, y: 24, size: 140, delay: "-1.5s" },
];

const centeredBubbleLayouts: Record<number, typeof bubbleLayouts> = {
  1: [{ x: 44, y: 8, size: 146, delay: "-2s" }],
  2: [
    { x: 28, y: 10, size: 136, delay: "-2s" },
    { x: 56, y: 3, size: 158, delay: "-5s" },
  ],
  3: [
    { x: 17, y: 10, size: 136, delay: "-2s" },
    { x: 43, y: 2, size: 158, delay: "-5s" },
    { x: 70, y: 12, size: 124, delay: "-1s" },
  ],
  4: [
    { x: 14, y: 8, size: 136, delay: "-2s" },
    { x: 39, y: 1, size: 158, delay: "-5s" },
    { x: 66, y: 10, size: 124, delay: "-1s" },
    { x: 43, y: 42, size: 116, delay: "-7s" },
  ],
  5: [
    { x: 17, y: 7, size: 136, delay: "-2s" },
    { x: 43, y: 1, size: 158, delay: "-5s" },
    { x: 70, y: 9, size: 124, delay: "-1s" },
    { x: 29, y: 41, size: 116, delay: "-7s" },
    { x: 57, y: 36, size: 146, delay: "-4s" },
  ],
};

const tones = ["violet", "mint", "peach", "blue"];

const reasonOptions: Array<{ id: LetGoReason; title: string; note: string }> = [
  { id: "not-now", title: "不是现在", note: "先沉入池底，30 天后再问我一次" },
  { id: "not-really", title: "其实没那么想要", note: "承认它不重要，然后让它直接消散" },
  { id: "borrowed", title: "这是别人的期待", note: "把声音还给别人，让它直接消散" },
];

const reasonLabels: Record<LetGoReason, string> = {
  "not-now": "不是现在",
  "not-really": "没那么想要",
  borrowed: "别人的期待",
  duel: "二选一后放下",
};

const themeOptions: Array<{ id: WallpaperTheme; name: string; note: string }> = [
  { id: "quiet", name: "夜潮", note: "安静" },
  { id: "warm", name: "晨光", note: "温暖" },
  { id: "firm", name: "深林", note: "坚定" },
  { id: "paper", name: "纸笺", note: "克制" },
  { id: "signal", name: "信号", note: "醒目" },
];

const canvasThemes: Record<WallpaperTheme, {
  start: string;
  middle: string;
  end: string;
  text: string;
  muted: string;
  line: string;
  glow: string;
  accent: string;
  motif: "orbs" | "paper" | "signal";
}> = {
  quiet: {
    start: "#17142f",
    middle: "#232044",
    end: "#111225",
    text: "#f5f1e7",
    muted: "rgba(244,241,232,.46)",
    line: "rgba(244,241,232,.18)",
    glow: "rgba(171,145,255,.24)",
    accent: "#ab91ff",
    motif: "orbs",
  },
  warm: {
    start: "#f3e8dc",
    middle: "#e5c6af",
    end: "#c98d75",
    text: "#382721",
    muted: "rgba(56,39,33,.52)",
    line: "rgba(56,39,33,.2)",
    glow: "rgba(255,244,211,.5)",
    accent: "#a85f48",
    motif: "orbs",
  },
  firm: {
    start: "#18382f",
    middle: "#21483c",
    end: "#0b1b16",
    text: "#f3edda",
    muted: "rgba(243,237,218,.5)",
    line: "rgba(243,237,218,.18)",
    glow: "rgba(129,197,161,.2)",
    accent: "#81c5a1",
    motif: "orbs",
  },
  paper: {
    start: "#f0eee7",
    middle: "#f0eee7",
    end: "#e9e5db",
    text: "#222220",
    muted: "rgba(34,34,32,.48)",
    line: "rgba(34,34,32,.13)",
    glow: "rgba(255,255,255,0)",
    accent: "#c45f4f",
    motif: "paper",
  },
  signal: {
    start: "#121212",
    middle: "#181818",
    end: "#080808",
    text: "#f4f0e6",
    muted: "rgba(244,240,230,.48)",
    line: "rgba(244,240,230,.16)",
    glow: "rgba(255,92,61,.16)",
    accent: "#ff6042",
    motif: "signal",
  },
};

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let current = "";

  for (const character of text) {
    const candidate = current + character;
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function formatRevisitDate(date?: string) {
  if (!date) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(date));
}

function formatCompletedDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date(date));
}

function vibrate(duration = 18) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(duration);
}

export default function Home() {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [discarded, setDiscarded] = useState<DiscardedWish[]>([]);
  const [history, setHistory] = useState<CycleRecord[]>([]);
  const [coins, setCoins] = useState<WishCoin[]>([]);
  const [hasEnumerated, setHasEnumerated] = useState(false);
  const [draft, setDraft] = useState("");
  const [droppingId, setDroppingId] = useState<number | null>(null);
  const [vanishingId, setVanishingId] = useState<number | null>(null);
  const [pendingWish, setPendingWish] = useState<Wish | null>(null);
  const [duelPair, setDuelPair] = useState<[number, number] | null>(null);
  const [duelLoser, setDuelLoser] = useState<number | null>(null);
  const [theme, setTheme] = useState<WallpaperTheme>("quiet");
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("monthly");
  const [phase, setPhase] = useState<"welcome" | "sort" | "final">("welcome");
  const [showHelp, setShowHelp] = useState(true);
  const [showPool, setShowPool] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const [inspirationBatch, setInspirationBatch] = useState(0);
  const [appearingId, setAppearingId] = useState<number | null>(null);
  const [stageShifting, setStageShifting] = useState(false);
  const [essentialsRevealed, setEssentialsRevealed] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [coinMessage, setCoinMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const nextId = useRef(20);
  const previousWishCount = useRef(0);
  const audioContext = useRef<AudioContext | null>(null);

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const horizonLabel = timeHorizonOptions.find((option) => option.id === timeHorizon)?.label ?? "月度";
  const periodStamp = timeHorizon === "monthly"
    ? `${currentMonthKey.replace("-", ".")} · 月度`
    : timeHorizon === "quarterly"
      ? `${currentYear} Q${currentQuarter} · 季度`
      : `${currentYear} · 年度`;
  const currentCycleKey = timeHorizon === "monthly"
    ? `month:${currentMonthKey}`
    : timeHorizon === "quarterly"
      ? `quarter:${currentYear}-Q${currentQuarter}`
      : `year:${currentYear}`;
  const currentInspirationGroups = inspirationGroups.map((group, index) => ({
    ...group,
    items: inspirationItemBatches[inspirationBatch % inspirationItemBatches.length][index],
  }));
  const isCollecting = !hasEnumerated;
  const canFinish = hasEnumerated && wishes.length > 0 && wishes.length <= 3;
  const canDuel = hasEnumerated && (wishes.length === 4 || wishes.length === 5);
  const duelWishes = duelPair
    ? duelPair.map((id) => wishes.find((wish) => wish.id === id)).filter(Boolean) as Wish[]
    : [];
  const dueCount = discarded.filter((wish) => wish.revisitAt && new Date(wish.revisitAt) <= now).length;
  const currentRecord = history.find((record) => record.cycleKey === currentCycleKey);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PersistedState>;
        if (Array.isArray(parsed.wishes)) setWishes(parsed.wishes);
        if (Array.isArray(parsed.discarded)) {
          setDiscarded(parsed.discarded.filter((wish) => wish.reason === "not-now"));
        }
        if (Array.isArray(parsed.history)) {
          const migrated = (parsed.history as Array<Partial<CycleRecord> & { monthKey?: string }>).map((record) => ({
            cycleKey: record.cycleKey ?? `month:${record.monthKey ?? currentMonthKey}`,
            periodStamp: record.periodStamp ?? `${(record.monthKey ?? currentMonthKey).replace("-", ".")} · 月度`,
            horizon: record.horizon ?? "monthly",
            savedAt: record.savedAt ?? new Date().toISOString(),
            theme: record.theme ?? "quiet",
            wishes: Array.isArray(record.wishes) ? record.wishes : [],
          }));
          setHistory(migrated);
          if (!Array.isArray(parsed.coins)) {
            setCoins(migrated.flatMap((record) => record.wishes.filter((wish) => wish.done).map((wish) => ({
              id: wish.id,
              text: wish.text,
              coinId: `${record.cycleKey}:${wish.id}:${wish.text}`,
              completedAt: record.savedAt,
              periodStamp: record.periodStamp,
              horizon: record.horizon,
            }))));
          }
        }
        if (Array.isArray(parsed.coins)) setCoins(parsed.coins);
        if (parsed.theme && themeOptions.some((option) => option.id === parsed.theme)) setTheme(parsed.theme);
        if (parsed.timeHorizon && timeHorizonOptions.some((option) => option.id === parsed.timeHorizon)) {
          setTimeHorizon(parsed.timeHorizon);
        }
        setHasEnumerated(parsed.hasEnumerated ?? ((parsed.wishes?.length ?? 0) >= 5));

        const allIds = [...(parsed.wishes ?? []), ...(parsed.discarded ?? [])].map((wish) => wish.id);
        nextId.current = Math.max(20, ...allIds) + 1;
      }
    } catch {
      // A damaged local draft should never block a fresh session.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state: PersistedState = { wishes, discarded, theme, timeHorizon, history, coins, hasEnumerated };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [coins, discarded, hasEnumerated, history, hydrated, theme, timeHorizon, wishes]);

  useEffect(() => {
    const previous = previousWishCount.current;
    previousWishCount.current = wishes.length;
    if (!hasEnumerated || previous <= 3 || wishes.length !== 3) return;
    setEssentialsRevealed(true);
    vibrate(28);
    const timer = window.setTimeout(() => setEssentialsRevealed(false), 2400);
    return () => window.clearTimeout(timer);
  }, [hasEnumerated, wishes.length]);

  function animateNewWish(id: number, count: number) {
    setAppearingId(id);
    window.setTimeout(() => setAppearingId((current) => current === id ? null : current), 760);
    if (count !== 5 || hasEnumerated) return;
    setStageShifting(true);
    window.setTimeout(() => setStageShifting(false), 1450);
  }

  function addWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const id = nextId.current++;
    const nextCount = wishes.length + 1;
    setWishes((current) => [...current, { id, text }]);
    if (nextCount >= 5) setHasEnumerated(true);
    animateNewWish(id, nextCount);
    setDraft("");
  }

  function addInspiration(text: string) {
    if (wishes.some((wish) => wish.text === text)) return;
    const id = nextId.current++;
    const nextCount = wishes.length + 1;
    setWishes((current) => current.some((wish) => wish.text === text) ? current : [...current, { id, text }]);
    if (nextCount >= 5) setHasEnumerated(true);
    animateNewWish(id, nextCount);
    vibrate(8);
  }

  function openReason(wish: Wish) {
    if (isCollecting || droppingId !== null || vanishingId !== null) return;
    setPendingWish(wish);
    setShowHelp(false);
  }

  function playReleaseSound(toPool: boolean) {
    const AudioConstructor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioConstructor) return;

    const context = audioContext.current ?? new AudioConstructor();
    audioContext.current = context;
    if (context.state === "suspended") void context.resume();
    const start = context.currentTime + 0.015;

    const tone = (
      when: number,
      duration: number,
      fromFrequency: number,
      toFrequency: number,
      volume: number,
      type: OscillatorType = "sine",
    ) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(fromFrequency, when);
      oscillator.frequency.exponentialRampToValueAtTime(toFrequency, when + duration);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(volume, when + Math.min(.012, duration / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(when);
      oscillator.stop(when + duration + .02);
    };

    const noise = (when: number, duration: number, volume: number, cutoff: number, filterType: BiquadFilterType) => {
      const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, frameCount, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < frameCount; index += 1) data[index] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = filterType;
      filter.frequency.setValueAtTime(cutoff, when);
      gain.gain.setValueAtTime(volume, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start(when);
    };

    // A tiny, rounded "啵": a fast downward pitch plus a breath of air.
    tone(start, .11, 720, 210, .11, "sine");
    tone(start + .008, .075, 1120, 520, .028, "triangle");
    noise(start, .055, .024, 1100, "highpass");

    if (!toPool) return;

    // The muted bottom impact arrives after the visual fall.
    tone(start + .44, .32, 105, 43, .085, "sine");
    noise(start + .45, .2, .035, 210, "lowpass");

    // Three ever-quieter water rings, followed by a filtered tail returning to silence.
    tone(start + .72, .2, 360, 250, .016, "sine");
    tone(start + .93, .22, 300, 210, .009, "sine");
    tone(start + 1.16, .24, 250, 180, .0045, "sine");
    noise(start + .72, .76, .009, 1450, "lowpass");
  }

  function playCoinSound() {
    const AudioConstructor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioConstructor) return;
    const context = audioContext.current ?? new AudioConstructor();
    audioContext.current = context;
    if (context.state === "suspended") void context.resume();
    const start = context.currentTime + .015;
    [880, 1320, 1760].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start + index * .035);
      gain.gain.setValueAtTime(.0001, start + index * .035);
      gain.gain.exponentialRampToValueAtTime(.045 / (index + 1), start + .018 + index * .035);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .32 + index * .05);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + index * .035);
      oscillator.stop(start + .38 + index * .05);
    });
  }

  function releaseWish(wish: Wish, reason: LetGoReason) {
    setPendingWish(null);
    setShowHelp(false);
    vibrate();
    const goesToPool = reason === "not-now";
    playReleaseSound(goesToPool);

    if (!goesToPool) {
      setVanishingId(wish.id);
      window.setTimeout(() => {
        setWishes((current) => current.filter((item) => item.id !== wish.id));
        setVanishingId(null);
      }, 480);
      return;
    }

    setDroppingId(wish.id);

    window.setTimeout(() => {
      setWishes((current) => current.filter((item) => item.id !== wish.id));
      setDiscarded((current) => [...current, {
        ...wish,
        reason: "not-now",
        discardedAt: new Date().toISOString(),
        revisitAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }]);
      setDroppingId(null);
    }, 720);
  }

  function undoLast() {
    const last = discarded.at(-1);
    if (!last) return;
    restoreWish(last);
  }

  function restoreWish(wish: DiscardedWish) {
    setDiscarded((current) => current.filter((item) => item.id !== wish.id));
    setWishes((current) => current.some((item) => item.id === wish.id) ? current : [...current, { id: wish.id, text: wish.text }]);
    animateNewWish(wish.id, wishes.length + 1);
    vibrate(10);
  }

  function beginWithHorizon(horizon: TimeHorizon) {
    setTimeHorizon(horizon);
    setPhase("sort");
  }

  function startFresh() {
    setWishes([]);
    setDiscarded([]);
    setDraft("");
    setDroppingId(null);
    setVanishingId(null);
    setPendingWish(null);
    setDuelPair(null);
    setHasEnumerated(false);
    setAppearingId(null);
    setEssentialsRevealed(false);
    setPhase("sort");
    setShowHelp(true);
  }

  function restartDemo() {
    setWishes(starterWishes);
    setDiscarded([]);
    setDraft("");
    setDroppingId(null);
    setVanishingId(null);
    setPendingWish(null);
    setDuelPair(null);
    setHasEnumerated(true);
    setAppearingId(null);
    setEssentialsRevealed(false);
    setPhase("sort");
    setShowHelp(true);
  }

  function startDuel() {
    if (!canDuel) return;
    setDuelPair([wishes[0].id, wishes[Math.ceil(wishes.length / 2)].id]);
    setDuelLoser(null);
  }

  function keepInDuel(keeper: Wish) {
    if (duelWishes.length !== 2 || duelLoser !== null) return;
    const loser = duelWishes.find((wish) => wish.id !== keeper.id);
    if (!loser) return;
    setDuelLoser(loser.id);
    vibrate(24);
    playReleaseSound(false);

    window.setTimeout(() => {
      setWishes((current) => {
        const next = current.filter((wish) => wish.id !== loser.id);
        if (next.length <= 3) {
          setDuelPair(null);
        } else {
          const nextKeeper = next.find((wish) => wish.id === keeper.id) ?? next[0];
          const challenger = next.find((wish) => wish.id !== nextKeeper.id) ?? next[1];
          setDuelPair([nextKeeper.id, challenger.id]);
        }
        return next;
      });
      setDuelLoser(null);
    }, 430);
  }

  function saveMonthAndFinish() {
    const previous = history.find((record) => record.cycleKey === currentCycleKey);
    const record: CycleRecord = {
      cycleKey: currentCycleKey,
      periodStamp,
      horizon: timeHorizon,
      savedAt: new Date().toISOString(),
      theme,
      wishes: wishes.map((wish) => ({
        ...wish,
        done: previous?.wishes.find((item) => item.text === wish.text)?.done ?? false,
        resolution: previous?.wishes.find((item) => item.text === wish.text)?.resolution,
      })),
    };
    setHistory((current) => [...current.filter((item) => item.cycleKey !== currentCycleKey), record]);
    setPhase("final");
  }

  function completeWish(record: CycleRecord, wish: MonthlyWish) {
    if (wish.done || completingId !== null) return;
    const coinId = `${record.cycleKey}:${wish.id}:${wish.text}`;
    setCompletingId(wish.id);
    vibrate(26);
    playCoinSound();
    window.setTimeout(() => {
      setHistory((current) => current.map((item) => item.cycleKey === record.cycleKey
        ? { ...item, wishes: item.wishes.map((candidate) => candidate.id === wish.id ? { ...candidate, done: true, resolution: undefined } : candidate) }
        : item));
      setCoins((current) => current.some((coin) => coin.coinId === coinId) ? current : [...current, {
        id: wish.id,
        text: wish.text,
        coinId,
        completedAt: new Date().toISOString(),
        periodStamp: record.periodStamp,
        horizon: record.horizon,
      }]);
      setCoinMessage(`“${wish.text}”已经成为了你的生活。`);
      setCompletingId(null);
      window.setTimeout(() => setCoinMessage(null), 2800);
    }, 720);
  }

  function resolveUnfinished(record: CycleRecord, wish: MonthlyWish, resolution: NonNullable<MonthlyWish["resolution"]>) {
    if (wish.done) return;
    setHistory((current) => current.map((item) => item.cycleKey === record.cycleKey
      ? { ...item, wishes: item.wishes.map((candidate) => candidate.id === wish.id ? { ...candidate, resolution } : candidate) }
      : item));

    if (resolution === "carried") {
      setWishes((current) => current.some((candidate) => candidate.text === wish.text)
        ? current
        : [...current, { id: nextId.current++, text: wish.text }]);
    }

    if (resolution === "pooled") {
      setWishes((current) => current.filter((candidate) => candidate.text !== wish.text));
      setDiscarded((current) => current.some((candidate) => candidate.text === wish.text) ? current : [...current, {
        id: nextId.current++,
        text: wish.text,
        reason: "not-now",
        discardedAt: new Date().toISOString(),
        revisitAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }]);
      playReleaseSound(true);
    } else if (resolution === "released") {
      setWishes((current) => current.filter((candidate) => candidate.text !== wish.text));
      playReleaseSound(false);
    }
    vibrate(12);
  }

  function downloadWallpaper() {
    const palette = canvasThemes[theme];
    const canvas = document.createElement("canvas");
    canvas.width = 1440;
    canvas.height = 2560;
    const context = canvas.getContext("2d");
    if (!context) return;

    const background = context.createLinearGradient(0, 0, 1440, 2560);
    background.addColorStop(0, palette.start);
    background.addColorStop(0.52, palette.middle);
    background.addColorStop(1, palette.end);
    context.fillStyle = background;
    context.fillRect(0, 0, 1440, 2560);

    if (palette.motif === "paper") {
      context.lineWidth = 1;
      context.strokeStyle = palette.line;
      for (let y = 310; y < 2300; y += 72) {
        context.beginPath();
        context.moveTo(86, y);
        context.lineTo(1354, y);
        context.stroke();
      }
      context.strokeStyle = palette.accent;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(166, 280);
      context.lineTo(166, 2320);
      context.stroke();
    } else if (palette.motif === "signal") {
      context.fillStyle = palette.accent;
      context.beginPath();
      context.arc(1160, 470, 270, 0, Math.PI * 2);
      context.fill();
      context.fillRect(0, 2180, 1440, 18);
      context.strokeStyle = palette.line;
      context.lineWidth = 2;
      for (let x = 112; x <= 1328; x += 304) {
        context.beginPath();
        context.moveTo(x, 280);
        context.lineTo(x, 2180);
        context.stroke();
      }
    } else {
      const glow = context.createRadialGradient(760, 900, 20, 760, 900, 870);
      glow.addColorStop(0, palette.glow);
      glow.addColorStop(1, "rgba(92,79,171,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, 1440, 2000);

      const circles = [[1120, 380, 210], [190, 820, 108], [1210, 1430, 132], [270, 2100, 170]];
      context.lineWidth = 2;
      circles.forEach(([x, y, radius]) => {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.strokeStyle = palette.line;
        context.stroke();
      });
    }

    context.fillStyle = palette.text;
    context.font = "600 52px Arial, sans-serif";
    context.letterSpacing = "1px";
    context.fillText("Minor.", 112, 150);
    context.fillStyle = palette.muted;
    context.font = "400 25px Arial, sans-serif";
    context.fillText(`${periodStamp} · MY ESSENTIALS`, 112, 218);

    context.fillStyle = palette.text;
    context.font = `${theme === "signal" ? "700 96px" : "500 86px"} "PingFang SC", "Microsoft YaHei", sans-serif`;
    context.fillText("重要的，", 112, 520);
    context.fillText("终于浮现了。", 112, 630);

    let cursorY = 930;
    wishes.forEach((wish, index) => {
      context.fillStyle = theme === "signal" ? palette.accent : palette.muted;
      context.font = "500 25px Arial, sans-serif";
      context.fillText(`0${index + 1}`, 116, cursorY - 14);
      context.fillStyle = palette.text;
      context.font = `${theme === "signal" ? "700 60px" : "500 58px"} "PingFang SC", "Microsoft YaHei", sans-serif`;
      const lines = wrapCanvasText(context, wish.text, 1080);
      lines.forEach((line, lineIndex) => context.fillText(line, 210, cursorY + lineIndex * 82));
      cursorY += Math.max(230, lines.length * 82 + 118);
    });

    context.strokeStyle = palette.line;
    context.beginPath();
    context.moveTo(112, 2290);
    context.lineTo(1328, 2290);
    context.stroke();
    context.fillStyle = palette.muted;
    context.font = '400 30px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.fillText("少一点，重要的才会浮现。", 112, 2382);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `minor-${timeHorizon}-${currentMonthKey}-${theme}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, "image/png");
  }

  const overlays = (
    <>
      {pendingWish && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPendingWish(null)}>
          <section className="reason-dialog" role="dialog" aria-modal="true" aria-labelledby="reason-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => setPendingWish(null)} aria-label="关闭">×</button>
            <p className="eyebrow">Before you let it go</p>
            <h2 id="reason-title">为什么愿意先放下<br />“{pendingWish.text}”？</h2>
            <div className="reason-options">
              {reasonOptions.map((option, index) => (
                <button key={option.id} type="button" onClick={() => releaseWish(pendingWish, option.id)}>
                  <span>0{index + 1}</span>
                  <strong>{option.title}</strong>
                  <small>{option.note}</small>
                  <i aria-hidden="true">→</i>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {duelPair && duelWishes.length === 2 && (
        <div className="modal-backdrop duel-backdrop" role="presentation">
          <section className="duel-dialog" role="dialog" aria-modal="true" aria-labelledby="duel-title">
            <button className="dialog-close" type="button" onClick={() => setDuelPair(null)} aria-label="关闭">×</button>
            <p className="eyebrow">One has to stay</p>
            <h2 id="duel-title">如果只能留下一个，<br />你会选择哪一个？</h2>
            <div className="duel-choices">
              {duelWishes.map((wish, index) => (
                <button
                  key={wish.id}
                  type="button"
                  className={`duel-bubble ${tones[index]} ${duelLoser === wish.id ? "losing" : ""}`}
                  onClick={() => keepInDuel(wish)}
                  disabled={duelLoser !== null}
                >
                  <span>留下</span>
                  <strong>{wish.text}</strong>
                </button>
              ))}
              <span className="duel-vs">OR</span>
            </div>
            <p className="duel-note">选择你更想留下的，另一个会发出轻轻一声“啵”，然后消散。</p>
          </section>
        </div>
      )}

      {showInspiration && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setShowInspiration(false)}>
          <aside className="side-sheet inspiration-sheet" role="dialog" aria-modal="true" aria-labelledby="inspiration-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => setShowInspiration(false)} aria-label="关闭">×</button>
            <p className="eyebrow">Borrowed wishes</p>
            <h2 id="inspiration-title">看看别人，<br />都想做些什么。</h2>
            <p className="sheet-intro">别人的愿望不一定适合你，但也许会替你想起一件，一直藏在心里的事。</p>
            <div className="inspiration-groups">
              {currentInspirationGroups.map((group, groupIndex) => (
                <section className="inspiration-group" key={group.title}>
                  <header>
                    <span>0{groupIndex + 1}</span>
                    <div><strong>{group.title}</strong><small>{group.note}</small></div>
                  </header>
                  <div>
                    {group.items.map((item) => {
                      const added = wishes.some((wish) => wish.text === item);
                      return (
                        <button key={item} type="button" className={added ? "added" : ""} onClick={() => addInspiration(item)} disabled={added}>
                          <span>{item}</span><i aria-hidden="true">{added ? "已加入" : "＋"}</i>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <button
              className="refresh-inspiration"
              type="button"
              onClick={() => setInspirationBatch((current) => (current + 1) % inspirationItemBatches.length)}
            >
              换一批 <span aria-hidden="true">↻</span>
            </button>
            <div className="inspiration-summary">
              <span>已经想起 {wishes.length} 件</span>
              <strong>{hasEnumerated ? "可以开始辨认重要的了" : `再写 ${Math.max(0, 5 - wishes.length)} 件，先别急着判断`}</strong>
            </div>
            <p className="local-note">灵感清单只负责提醒，最终留下什么由你决定</p>
          </aside>
        </div>
      )}

      {showPool && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setShowPool(false)}>
          <aside className="side-sheet" role="dialog" aria-modal="true" aria-labelledby="pool-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => setShowPool(false)} aria-label="关闭">×</button>
            <p className="eyebrow">The wishing pool</p>
            <h2 id="pool-title">你放下的，<br />并没有消失。</h2>
            <p className="sheet-intro">它们只是暂时沉到水面之下。想念的时候，随时可以捞回来。</p>
            <div className="pool-list">
              {discarded.length === 0 ? (
                <div className="sheet-empty">池底还是空的。</div>
              ) : [...discarded].reverse().map((wish) => (
                <article className="pool-item" key={wish.id}>
                  <div>
                    <span>{reasonLabels[wish.reason]}</span>
                    <strong>{wish.text}</strong>
                    {wish.revisitAt && <small>{formatRevisitDate(wish.revisitAt)}再问我</small>}
                  </div>
                  <button type="button" onClick={() => restoreWish(wish)}>捞回来 ↑</button>
                </article>
              ))}
            </div>
            <p className="local-note">记录仅保存在这台设备上</p>
          </aside>
        </div>
      )}

      {showReview && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setShowReview(false)}>
          <aside className="side-sheet review-sheet" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => setShowReview(false)} aria-label="关闭">×</button>
            <p className="eyebrow">Reflection</p>
            <h2 id="review-title">愿望后来，<br />去了哪里？</h2>
            <p className="sheet-intro">完成的凝结成硬币。没有完成的，也可以继续、沉入池底，或在此刻正式放下。</p>
            <div className="history-list">
              {history.length === 0 ? (
                <div className="sheet-empty">留下三件事后，你的记录会出现在这里。</div>
              ) : [...history].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((record) => (
                <article className="history-card" key={record.cycleKey}>
                  <header>
                    <strong>{record.periodStamp}</strong>
                    <span>{record.wishes.filter((wish) => wish.done).length} 枚愿望硬币</span>
                  </header>
                  <ul>
                    {record.wishes.map((wish) => (
                      <li className={wish.done ? "done" : wish.resolution ? "resolved" : ""} key={wish.id}>
                        <div className="review-wish-line">
                          <i aria-hidden="true">{wish.done ? "●" : "○"}</i>
                          <span>{wish.text}</span>
                          {wish.done && <em>已存入</em>}
                          {!wish.done && wish.resolution && <em>{wish.resolution === "carried" ? "继续" : wish.resolution === "pooled" ? "池底" : "已放下"}</em>}
                        </div>
                        {!wish.done && !wish.resolution && (
                          <div className="review-actions">
                            <button type="button" onClick={() => completeWish(record, wish)}>完成了 · 存成硬币</button>
                            <button type="button" onClick={() => resolveUnfinished(record, wish, "carried")}>继续带着</button>
                            <button type="button" onClick={() => resolveUnfinished(record, wish, "pooled")}>沉入池底</button>
                            <button type="button" onClick={() => resolveUnfinished(record, wish, "released")}>现在放下</button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className="local-note">记录仅保存在这台设备上</p>
          </aside>
        </div>
      )}

      {showBank && (
        <div className="sheet-backdrop bank-backdrop" role="presentation" onMouseDown={() => setShowBank(false)}>
          <aside className="side-sheet bank-sheet" role="dialog" aria-modal="true" aria-labelledby="bank-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => setShowBank(false)} aria-label="关闭">×</button>
            <p className="eyebrow">The wish bank</p>
            <h2 id="bank-title">我的愿望<br />储蓄罐。</h2>
            <p className="sheet-intro">这里存着的，不是还没实现的愿望，而是你真正为自己做过的事。</p>
            <div className={`coin-jar ${coins.length === 0 ? "empty" : ""}`} aria-label={`已经存下 ${coins.length} 枚愿望硬币`}>
              <div className="jar-neck" />
              <div className="jar-glass">
                {coins.length === 0 ? <span>第一枚硬币，正在未来等你。</span> : [...coins].reverse().map((coin, index) => (
                  <div
                    key={coin.coinId}
                    className={`wish-coin tone-${index % 4}`}
                    style={{ "--coin-turn": `${-12 + (index % 5) * 6}deg` } as CSSProperties}
                    title={`${coin.text} · ${formatCompletedDate(coin.completedAt)}`}
                  >
                    <span>{coin.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="coin-ledger">
              {coins.length === 0 ? null : [...coins].reverse().map((coin) => (
                <article key={coin.coinId}>
                  <span className="ledger-coin" aria-hidden="true">m</span>
                  <div><strong>{coin.text}</strong><small>{formatCompletedDate(coin.completedAt)} · {coin.periodStamp}</small></div>
                </article>
              ))}
            </div>
            <p className="local-note">{coins.length} 件想做的事，已经成为了生活</p>
          </aside>
        </div>
      )}

      {coinMessage && (
        <div className="coin-toast" role="status"><span>m</span><p>{coinMessage}<small>一枚愿望硬币已落入储蓄罐</small></p></div>
      )}
    </>
  );

  if (phase === "welcome") {
    return (
      <main className="welcome-page">
        <header className="welcome-header">
          <div className="welcome-brand"><span className="mark">m</span><strong>Minor.</strong></div>
          <span className="brand-principle">最重要的事情不超过3件</span>
        </header>
        <section className="welcome-layout">
          <div className="welcome-copy">
            <span>先选择一段时间</span>
            <h1>你想为接下来的多久，<br />选出最重要的三件事？</h1>
            <p>这个时间范围，会帮助你判断一件事是现在重要，还是可以留到以后。最后留下的三件，也会和它一起出现在壁纸上。</p>
          </div>
          <div className="horizon-panel">
            <header>
              <strong>选择时间范围</strong>
              <small>你现在想为多远的未来做一次取舍？</small>
            </header>
            <div className="horizon-options" aria-label="选择整理周期">
              {timeHorizonOptions.map((option, index) => (
                <button key={option.id} type="button" onClick={() => beginWithHorizon(option.id)}>
                  <span>0{index + 1}</span>
                  <strong>{option.label}</strong>
                  <small>{option.note}</small>
                  <i aria-hidden="true">→</i>
                </button>
              ))}
            </div>
          </div>
        </section>
        <p className="welcome-footer">少一点，重要的才会浮现。</p>
      </main>
    );
  }

  if (phase === "final") {
    return (
      <main className="final-page">
        <header className="site-header final-header">
          <div className="brand-lockup">
            <button className="wordmark" type="button" onClick={restartDemo} aria-label="回到 Minor 首页">
              <span className="mark">m</span><span>Minor.</span>
            </button>
            <span className="brand-principle">最重要的事情不超过3件</span>
          </div>
          <span className="step-label">03 / 看见重要的</span>
          <div className="header-actions">
            <button className="text-button bank-link" type="button" onClick={() => setShowBank(true)}>储蓄罐 <span>{coins.length}</span></button>
            <button className="text-button" type="button" onClick={() => setShowReview(true)}>回顾</button>
            <button className="text-button" type="button" onClick={() => setPhase("sort")}>返回修改</button>
          </div>
        </header>

        <section className="final-layout">
          <div className="final-copy">
            <p className="eyebrow">Your essentials · {periodStamp}</p>
            <h1>重要的，<br />终于浮现了。</h1>
            <p className="final-intro">把它留在每天都会看见的地方。不是为了催促自己，而是提醒自己：时间要用在真正想要的生活上。</p>
            <div className="essential-progress" aria-label="本周期愿望进度">
              {wishes.map((wish, index) => {
                const savedWish = currentRecord?.wishes.find((item) => item.text === wish.text);
                return (
                  <article className={`${savedWish?.done ? "completed" : ""} ${completingId === wish.id ? "minting" : ""}`} key={wish.id}>
                    <span>{savedWish?.done ? "m" : `0${index + 1}`}</span>
                    <strong>{wish.text}</strong>
                    {savedWish?.done ? <small>已存入储蓄罐</small> : (
                      <button type="button" onClick={() => currentRecord && completeWish(currentRecord, savedWish ?? { ...wish, done: false })} disabled={!currentRecord || completingId !== null}>
                        我完成了
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="theme-picker" aria-label="选择壁纸风格">
              {themeOptions.map((option) => (
                <button key={option.id} type="button" className={theme === option.id ? "active" : ""} onClick={() => setTheme(option.id)}>
                  <i className={`theme-dot ${option.id}`} aria-hidden="true" />
                  <span><strong>{option.name}</strong><small>{option.note}</small></span>
                </button>
              ))}
            </div>
            <div className="final-actions">
              <button className="primary-button light" type="button" onClick={downloadWallpaper}>下载手机壁纸 <span aria-hidden="true">↓</span></button>
              <button className="quiet-button" type="button" onClick={() => setShowBank(true)}>打开愿望储蓄罐</button>
              <button className="quiet-button" type="button" onClick={restartDemo}>重新开始</button>
            </div>
          </div>

          <div className="wallpaper-wrap">
            <div className={`wallpaper theme-${theme}`} aria-label="你的 Minor 提醒壁纸预览">
              <span className="wallpaper-orb orb-one" /><span className="wallpaper-orb orb-two" />
              <div className="wallpaper-top"><strong>Minor.</strong><span>{periodStamp} · MY ESSENTIALS</span></div>
              <h2>重要的，<br />终于浮现了。</h2>
              <ol>
                {wishes.map((wish, index) => <li key={wish.id}><span>0{index + 1}</span><strong>{wish.text}</strong></li>)}
              </ol>
              <p>少一点，重要的才会浮现。</p>
            </div>
            <span className="wallpaper-caption">选择一种风格，再下载保存到相册</span>
          </div>
        </section>
        {overlays}
      </main>
    );
  }

  return (
    <main className="sort-page">
      <header className="site-header">
        <div className="brand-lockup">
          <button className="wordmark" type="button" onClick={restartDemo} aria-label="重置 Minor"><span className="mark">m</span><span>Minor.</span></button>
          <span className="brand-principle">最重要的事情不超过3件</span>
        </div>
        <span className="step-label">{isCollecting ? "01 / 穷尽列举" : "02 / 去掉次要的"} · {horizonLabel}</span>
        <div className="header-actions">
          <button className="text-button bank-link" type="button" onClick={() => setShowBank(true)}>储蓄罐 <span>{coins.length}</span></button>
          <button className="text-button" type="button" onClick={() => setShowReview(true)}>回顾</button>
          <button className="text-button" type="button" onClick={startFresh}>换成我的愿望</button>
        </div>
      </header>

      <section className="intro">
        <div className="intro-main">
          <h1 className={isCollecting ? "collecting-title" : undefined}>{isCollecting
            ? "日子很满，重要的事却常常被留在以后。"
            : "让次要的轻轻沉下去，重要的，才会浮出水面。"}</h1>
          <button className="inspiration-trigger" type="button" onClick={() => setShowInspiration(true)}>
            <span aria-hidden="true">↗</span> 看看别人的愿望清单
          </button>
        </div>
        <div className="intro-side">
          <form className="wish-form" onSubmit={addWish}>
            <label className="sr-only" htmlFor="new-wish">添加一件想做的事</label>
            <input id="new-wish" value={draft} maxLength={26} onChange={(event) => setDraft(event.target.value)} placeholder={isCollecting ? "从一件想为自己做的事开始······" : "还有一件想做的事…"} />
            <button type="submit" aria-label="添加愿望" disabled={!draft.trim()}>＋</button>
          </form>
        </div>
      </section>

      <section className={`bubble-field ${stageShifting ? "stage-shifting" : ""} ${essentialsRevealed ? "essentials-revealed" : ""}`} aria-live="polite">
        <div className="field-meta">
          <span>{isCollecting ? `${wishes.length} 个愿望 · 先尽量写满 5 个` : `${wishes.length} 个愿望漂浮着`}</span>
          {discarded.length > 0 && <button type="button" onClick={undoLast}>撤回上一个</button>}
        </div>

        {wishes.length > 0 && (isCollecting || showHelp) && (
          <div className={`tap-hint ${isCollecting ? "collect-hint" : ""}`} aria-hidden="true">
            <span>{isCollecting ? "＋" : "↘"}</span>
            {isCollecting ? `先别判断，再想 ${Math.max(0, 5 - wishes.length)} 件` : "轻点一个气泡，问问为什么"}
          </div>
        )}

        <div className="bubbles" aria-label="你的愿望">
          {wishes.map((wish, index) => {
            const layouts = centeredBubbleLayouts[wishes.length] ?? bubbleLayouts;
            const layout = layouts[index % layouts.length];
            return (
              <button
                key={wish.id}
                type="button"
                className={`bubble ${tones[index % tones.length]} ${isCollecting ? "collecting" : ""} ${appearingId === wish.id ? "entering" : ""} ${droppingId === wish.id ? "dropping" : ""} ${vanishingId === wish.id ? "vanishing" : ""}`}
                style={{ "--x": `${layout.x}%`, "--y": `${layout.y}%`, "--size": `${layout.size}px`, "--delay": layout.delay } as CSSProperties}
                onClick={() => openReason(wish)}
                disabled={isCollecting || droppingId !== null || vanishingId !== null}
                aria-label={isCollecting ? `已列举：${wish.text}` : `考虑放下：${wish.text}`}
              >
                <span className="bubble-shine" /><span>{wish.text}</span>
              </button>
            );
          })}
        </div>

        {wishes.length === 0 && <div className="empty-state"><span>○</span><h2>许愿池在等待</h2></div>}

        {essentialsRevealed && <div className="reveal-message" role="status">重要的，终于浮现了。</div>}

        <button className={`wish-pool ${droppingId !== null ? "receiving" : ""}`} type="button" onClick={() => setShowPool(true)} aria-label="查看许愿池">
          <span className="pool-ring ring-one" /><span className="pool-ring ring-two" /><span className="pool-glow" />
          <span className="pool-label">许愿池 · {discarded.length} 件已放下{dueCount > 0 ? ` · ${dueCount} 件等你重看` : ""}</span>
        </button>
      </section>

      <footer className="decision-bar">
        <div className="decision-count"><span>现在还剩</span><strong>{wishes.length}</strong><span>件</span></div>
        <div className="decision-progress" aria-hidden="true"><span style={{ width: `${isCollecting ? Math.min(100, Math.max(5, (wishes.length / 5) * 100)) : Math.min(100, Math.max(8, (3 / Math.max(wishes.length, 3)) * 100))}%` }} /></div>
        <p>{isCollecting
          ? `再写 ${Math.max(0, 5 - wishes.length)} 件，先别急着判断。`
          : canFinish ? "就是它们了。" : wishes.length === 0 ? "先留下一件吧。" : canDuel ? "难选？让它们面对面。" : `再放下 ${Math.max(0, wishes.length - 3)} 件，就能看见答案。`}</p>
        <div className="decision-actions">
          {canDuel && <button className="compare-button" type="button" onClick={startDuel}>帮我二选一</button>}
          <button className="primary-button" type="button" disabled={!canFinish} onClick={saveMonthAndFinish}>
            {isCollecting ? "先写满 5 个" : "留下这些"} <span aria-hidden="true">→</span>
          </button>
        </div>
      </footer>
      {overlays}
    </main>
  );
}
