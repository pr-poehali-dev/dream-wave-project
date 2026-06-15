import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

// ── Типы призов ──────────────────────────────────────────────────────────────
interface Prize {
  id: number;
  label: string;
  emoji: string;
  color: string;
  winChance: number; // шанс выпадения в своём окне (5 прокрутов)
}

// Призы в порядке ценности (1й — самый ценный)
const PRIZES: Prize[] = [
  { id: 1, label: "Чупачупс", emoji: "🍭", color: "#ed4245", winChance: 0.75 },
  { id: 2, label: "Органайзер для мелочей", emoji: "🗂️", color: "#5865f2", winChance: 0.45 },
  { id: 3, label: "Яблокорезка из нержавейки", emoji: "🍎", color: "#faa61a", winChance: 0.35 },
  { id: 4, label: "Ролик для одежды 60 листов", emoji: "🧹", color: "#3ba55c", winChance: 0.15 },
  { id: 5, label: "Косметичка стильная", emoji: "👜", color: "#eb459e", winChance: 0.05 },
];

const PRIZE_IMAGES: Record<number, string> = {
  1: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/files/e688d9dc-8d43-410e-a4a6-413e3da0a0fa.jpg",
  2: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/bucket/5c9ce5b3-e991-4669-9848-87f8d2c2e4ec.png",
  3: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/bucket/3265aa2f-2583-414e-b309-bddc21ae2a40.png",
  4: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/bucket/aa328fab-8027-40e3-9dc6-cd015602bb78.png",
  5: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/bucket/769fc24c-1ac5-4957-a020-c147188c60da.png",
};

const CONSOLATION = { label: "Чупачупс", emoji: "🍭", color: "#ed4245" };

// Сколько прокрутов в каждом «окне» (5 прокрутов → 1 окно)
const WINDOW_SIZE = 5;
const TOTAL_SPINS = 25;
const MAX_PLAYERS = 4;

// Сектора на колесе (8 штук, смешаны)
const WHEEL_SECTORS = [
  { emoji: "👑", color: "#faa61a" },
  { emoji: "💎", color: "#5865f2" },
  { emoji: "🌸", color: "#eb459e" },
  { emoji: "🎀", color: "#3ba55c" },
  { emoji: "✨", color: "#ed4245" },
  { emoji: "💫", color: "#4752c4" },
  { emoji: "🎂", color: "#c27c0e" },
  { emoji: "🏆", color: "#3b82f6" },
];

const SECTOR_COUNT = WHEEL_SECTORS.length;
const SECTOR_ANGLE = 360 / SECTOR_COUNT;

// ── Типы состояния игры ───────────────────────────────────────────────────────
type GamePhase =
  | "idle"        // ещё не начали
  | "spinning"    // барабан крутится
  | "won"         // выиграли — предлагаем взять или крутить дальше
  | "took"        // взяли приз — игра окончена
  | "lost"        // остановились на уже выигранном но потом проиграли
  | "consolation" // получили утешительный
  | "done";       // финал (все 25 прокрутов)

interface PlayerState {
  id: number;
  spinsUsed: number;      // всего прокрутов использовано
  currentWindow: number;  // текущее «окно» 0-4 (каждое = 5 прокрутов)
  spinsInWindow: number;  // прокрутов в текущем окне
  wonPrizes: Prize[];     // выигранные призы (накопленные)
  pendingPrize: Prize | null; // приз, который сейчас предлагают взять
  phase: GamePhase;
  log: string[];          // лог событий
}

function makePlayer(id: number): PlayerState {
  return {
    id,
    spinsUsed: 0,
    currentWindow: 0,
    spinsInWindow: 0,
    wonPrizes: [],
    pendingPrize: null,
    phase: "idle",
    log: [],
  };
}

// Определяем приз для текущего окна (окна 0-4)
function getPrizeForWindow(window: number): Prize {
  // окно 0 → приз 1 (Чупачупс), окно 4 → приз 5 (Косметика)
  return PRIZES[Math.max(0, Math.min(window, PRIZES.length - 1))];
}

// ── Рычаг казино ─────────────────────────────────────────────────────────────
function Lever({ onPull, disabled }: { onPull: () => void; disabled: boolean }) {
  const [pulled, setPulled] = useState(false);

  function handlePull() {
    if (disabled || pulled) return;
    setPulled(true);
    onPull();
    setTimeout(() => setPulled(false), 800);
  }

  return (
    <div className="flex flex-col items-center select-none" style={{ width: 60 }}>
      {/* Шарик */}
      <div
        onClick={handlePull}
        className="transition-all duration-300 cursor-pointer"
        style={{
          transform: pulled ? "translateY(80px)" : "translateY(0px)",
          filter: disabled ? "grayscale(1) opacity(0.4)" : "none",
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-lg"
          style={{
            background: pulled
              ? "radial-gradient(circle at 35% 35%, #ff6b6b, #c0392b)"
              : "radial-gradient(circle at 35% 35%, #ff9999, #e74c3c)",
            boxShadow: pulled
              ? "0 2px 8px rgba(231,76,60,0.4)"
              : "0 4px 16px rgba(231,76,60,0.6)",
          }}
        >
          🎰
        </div>
      </div>

      {/* Стержень */}
      <div
        className="rounded-full"
        style={{
          width: 8,
          height: pulled ? 40 : 120,
          marginTop: pulled ? -40 : 0,
          background: "linear-gradient(180deg, #aaa 0%, #777 50%, #aaa 100%)",
          boxShadow: "2px 0 4px rgba(0,0,0,0.4)",
          transition: "height 0.3s, margin-top 0.3s",
        }}
      />

      {/* Основание */}
      <div
        className="rounded-lg"
        style={{
          width: 24,
          height: 40,
          background: "linear-gradient(180deg, #555 0%, #333 100%)",
          boxShadow: "0 4px 8px rgba(0,0,0,0.5)",
        }}
      />

      {/* Подпись */}
      <div className="text-[#8e9297] text-xs mt-2 text-center">
        {disabled ? "⏳" : "Дёрни!"}
      </div>
    </div>
  );
}

// ── Колесо ────────────────────────────────────────────────────────────────────
function Wheel({ angle, spinning }: { angle: number; spinning: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
      {/* Внешнее кольцо */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, #202225 0%, #36393f 50%, #202225 100%)",
          boxShadow: "0 0 40px rgba(88,101,242,0.4), inset 0 0 20px rgba(0,0,0,0.5)",
        }}
      />

      {/* Колесо */}
      <div
        className="absolute rounded-full overflow-hidden"
        style={{
          width: 260,
          height: 260,
          transform: `rotate(${angle}deg)`,
          transition: spinning ? "transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
        }}
      >
        <svg width="260" height="260" viewBox="0 0 260 260">
          {WHEEL_SECTORS.map((sector, i) => {
            const startAngle = (i * SECTOR_ANGLE - 90) * (Math.PI / 180);
            const endAngle = ((i + 1) * SECTOR_ANGLE - 90) * (Math.PI / 180);
            const x1 = 130 + 130 * Math.cos(startAngle);
            const y1 = 130 + 130 * Math.sin(startAngle);
            const x2 = 130 + 130 * Math.cos(endAngle);
            const y2 = 130 + 130 * Math.sin(endAngle);
            const midAngle = ((i + 0.5) * SECTOR_ANGLE - 90) * (Math.PI / 180);
            const textX = 130 + 80 * Math.cos(midAngle);
            const textY = 130 + 80 * Math.sin(midAngle);
            return (
              <g key={i}>
                <path
                  d={`M 130 130 L ${x1} ${y1} A 130 130 0 0 1 ${x2} ${y2} Z`}
                  fill={sector.color}
                  stroke="#202225"
                  strokeWidth="2"
                  opacity="0.85"
                />
                <text
                  x={textX}
                  y={textY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="22"
                  style={{ userSelect: "none" }}
                >
                  {sector.emoji}
                </text>
              </g>
            );
          })}
          {/* Центральный круг */}
          <circle cx="130" cy="130" r="28" fill="#2f3136" stroke="#202225" strokeWidth="3" />
          <text x="130" y="130" textAnchor="middle" dominantBaseline="central" fontSize="20">🎂</text>
        </svg>
      </div>

      {/* Стрелка-указатель */}
      <div
        className="absolute"
        style={{
          top: -8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "12px solid transparent",
          borderRight: "12px solid transparent",
          borderTop: "24px solid #faa61a",
          filter: "drop-shadow(0 2px 4px rgba(250,166,26,0.6))",
          zIndex: 10,
        }}
      />
    </div>
  );
}

// ── Прогресс-бар прокрутов ────────────────────────────────────────────────────
function SpinProgress({ player }: { player: PlayerState }) {
  const total = TOTAL_SPINS;
  const used = player.spinsUsed;
  const pct = (used / total) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-[#b9bbbe] mb-1">
        <span>Прокруты: {used}/{total}</span>
        <span>Окно {player.currentWindow + 1}/5</span>
      </div>
      <div className="h-2 bg-[#202225] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #5865f2, #faa61a)",
          }}
        />
      </div>
      {/* Окна */}
      <div className="flex gap-1 mt-2">
        {Array.from({ length: 5 }).map((_, wi) => {
          const windowPrize = getPrizeForWindow(wi);
          const isPast = wi < player.currentWindow;
          const isCurrent = wi === player.currentWindow;
          return (
            <div
              key={wi}
              className="flex-1 rounded text-center py-1 text-xs font-semibold border"
              style={{
                borderColor: isCurrent ? windowPrize.color : "#40444b",
                background: isCurrent ? windowPrize.color + "22" : isPast ? "#1a1b1e" : "transparent",
                color: isCurrent ? windowPrize.color : isPast ? "#4f545c" : "#8e9297",
              }}
            >
              {windowPrize.emoji}
              <div style={{ fontSize: 9 }}>
                {Math.round(windowPrize.winChance * 100)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Лог сообщений ─────────────────────────────────────────────────────────────
function GameLog({ messages }: { messages: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={ref}
      className="bg-[#202225] rounded-lg p-3 space-y-1 overflow-y-auto"
      style={{ maxHeight: 140 }}
    >
      {messages.length === 0 && (
        <p className="text-[#72767d] text-xs">Нажми «Крутить» — и начнём!</p>
      )}
      {messages.map((m, i) => (
        <p key={i} className="text-[#dcddde] text-xs leading-relaxed">{m}</p>
      ))}
    </div>
  );
}

// ── Главный компонент ─────────────────────────────────────────────────────────
export default function Index() {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultText, setResultText] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const totalAngleRef = useRef(0);

  const player = players[currentPlayerIndex] ?? null;

  function startGame(count: number) {
    setPlayerCount(count);
    setPlayers(Array.from({ length: count }, (_, i) => makePlayer(i + 1)));
    setCurrentPlayerIndex(0);
    setWheelAngle(0);
    totalAngleRef.current = 0;
  }

  function updatePlayer(update: Partial<PlayerState> | ((p: PlayerState) => PlayerState)) {
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === currentPlayerIndex
          ? typeof update === "function"
            ? update(p)
            : { ...p, ...update }
          : p
      )
    );
  }

  function addLog(msg: string) {
    updatePlayer((p) => ({ ...p, log: [...p.log, msg] }));
  }

  function spin() {
    if (!player || spinning) return;
    if (player.phase === "won") return; // нужно принять решение

    // Вращаем колесо
    const extraSpins = 5 + Math.floor(Math.random() * 5); // 5-9 оборотов
    const extraAngle = Math.floor(Math.random() * 360);
    const delta = extraSpins * 360 + extraAngle;
    totalAngleRef.current += delta;
    setWheelAngle(totalAngleRef.current);
    setSpinning(true);

    // После анимации
    setTimeout(() => {
      setSpinning(false);

      setPlayers((prev) => {
        const p = { ...prev[currentPlayerIndex] };
        const newSpinsUsed = p.spinsUsed + 1;
        const newSpinsInWindow = p.spinsInWindow + 1;
        const currentWindow = p.currentWindow;
        const prize = getPrizeForWindow(currentWindow);
        const log = [...p.log];

        log.push(`Прокрут #${newSpinsUsed} (окно ${currentWindow + 1}, шанс ${Math.round(prize.winChance * 100)}%)`);

        // Проверяем выигрыш
        const roll = Math.random();
        const won = roll < prize.winChance;

        let newPhase: GamePhase = p.phase;
        let pendingPrize = p.pendingPrize;
        let wonPrizes = p.wonPrizes;

        if (won) {
          // Выиграли приз в этом окне!
          log.push(`🎉 Выпало: ${prize.emoji} ${prize.label}!`);
          pendingPrize = prize;
          wonPrizes = [...p.wonPrizes, prize];
          newPhase = "won";
        } else {
          log.push(`Не выпало. Продолжаем…`);

          // Проверяем: завершили окно (5 прокрутов)?
          if (newSpinsInWindow >= WINDOW_SIZE) {
            // Переходим к следующему окну
            const nextWindow = currentWindow + 1;
            if (newSpinsUsed >= TOTAL_SPINS || nextWindow >= PRIZES.length) {
              // Все 25 прокрутов — утешительный приз
              log.push(`🎁 Все прокруты использованы! Получаешь утешительный приз.`);
              newPhase = "consolation";
            } else {
              log.push(`➡️ Следующее окно! Теперь разыгрывается: ${getPrizeForWindow(nextWindow).emoji} ${getPrizeForWindow(nextWindow).label}`);
              // сбросим spinsInWindow в след. итерации
              const updatedPlayer: PlayerState = {
                ...p,
                spinsUsed: newSpinsUsed,
                spinsInWindow: 0,
                currentWindow: nextWindow,
                pendingPrize,
                wonPrizes,
                phase: newPhase,
                log,
              };
              return prev.map((pl, i) => (i === currentPlayerIndex ? updatedPlayer : pl));
            }
          }
        }

        const updatedPlayer: PlayerState = {
          ...p,
          spinsUsed: newSpinsUsed,
          spinsInWindow: won ? p.spinsInWindow : newSpinsInWindow,
          currentWindow: p.currentWindow,
          pendingPrize,
          wonPrizes,
          phase: newPhase,
          log,
        };
        return prev.map((pl, i) => (i === currentPlayerIndex ? updatedPlayer : pl));
      });
    }, 3200);
  }

  function takePrize() {
    if (!player || !player.pendingPrize) return;
    addLog(`✅ Игрок взял ${player.pendingPrize.emoji} ${player.pendingPrize.label}!`);
    updatePlayer({ phase: "took" });
  }

  function continueSpin() {
    if (!player) return;
    // Отказался от приза — продолжает, но если проиграет — теряет ВСЁ
    addLog(`🎲 Продолжаем! Выигранные призы аннулируются если проиграешь…`);
    // Переходим к следующему окну после выигрыша
    const nextWindow = player.currentWindow + 1;
    if (player.spinsUsed >= TOTAL_SPINS || nextWindow >= PRIZES.length) {
      addLog(`🎁 Больше прокрутов нет — утешительный приз!`);
      updatePlayer({ phase: "consolation", pendingPrize: null });
    } else {
      addLog(`➡️ Следующее окно: ${getPrizeForWindow(nextWindow).emoji} ${getPrizeForWindow(nextWindow).label} (${Math.round(getPrizeForWindow(nextWindow).winChance * 100)}%)`);
      updatePlayer({
        phase: "idle",
        pendingPrize: null,
        currentWindow: nextWindow,
        spinsInWindow: 0,
      });
    }
  }

  function nextPlayer() {
    const next = currentPlayerIndex + 1;
    if (next < (playerCount ?? 0)) {
      setCurrentPlayerIndex(next);
      setWheelAngle(0);
      totalAngleRef.current = 0;
    }
  }

  function resetGame() {
    setPlayerCount(null);
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setWheelAngle(0);
    totalAngleRef.current = 0;
    setShowResult(false);
  }

  const isGameOver =
    player &&
    (player.phase === "took" ||
      player.phase === "consolation" ||
      player.phase === "done");

  const allDone =
    playerCount !== null &&
    players.length === playerCount &&
    players.every(
      (p) =>
        p.phase === "took" || p.phase === "consolation" || p.phase === "done"
    );

  // ── Экран выбора игроков ──────────────────────────────────────────────────
  if (playerCount === null) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
        style={{
          background: "radial-gradient(ellipse at top, #1a0533 0%, #0d001a 60%, #000 100%)",
        }}
      >
        {/* Конфетти-звёзды */}
        {["🎉","✨","🎊","🍭","🎁","⭐","🎈","💫","🎀","🌟"].map((em, i) => (
          <div
            key={i}
            className="absolute text-3xl pointer-events-none animate-bounce"
            style={{
              left: `${5 + i * 9}%`,
              top: `${10 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${1.5 + (i % 3) * 0.5}s`,
              opacity: 0.7,
            }}
          >
            {em}
          </div>
        ))}

        {/* Цветные круги-блики */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(235,69,158,0.25) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(88,101,242,0.25) 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(250,166,26,0.2) 0%, transparent 70%)" }} />

        {/* Контент */}
        <div className="relative z-10 text-center">
          <div className="text-8xl mb-6" style={{ filter: "drop-shadow(0 0 30px rgba(250,166,26,0.8))" }}>
            🎂
          </div>
          <h1
            className="text-5xl sm:text-6xl font-bold mb-3"
            style={{
              background: "linear-gradient(135deg, #faa61a, #eb459e, #5865f2)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 20px rgba(235,69,158,0.5))",
            }}
          >
            Барабан Удачи
          </h1>
          <p className="text-pink-200 text-xl mb-12 font-medium">
            С днём рождения, мамочка! 🎉
          </p>

          <button
            onClick={() => startGame(1)}
            className="px-16 py-5 rounded-2xl font-bold text-2xl text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #eb459e, #faa61a)",
              boxShadow: "0 0 40px rgba(235,69,158,0.6), 0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            🎰 Играть!
          </button>

          <p className="text-purple-300 text-sm mt-6 opacity-70">
            5 призов · 25 прокрутов · 1 победитель
          </p>
        </div>
      </div>
    );
  }

  // ── Экран итогов ──────────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="min-h-screen bg-[#36393f] flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-2">Игра завершена!</h1>
          <p className="text-[#b9bbbe]">Итоги праздничного барабана</p>
        </div>

        <div className="bg-[#2f3136] border border-[#202225] rounded-xl p-6 w-full max-w-lg mb-6">
          {players.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg mb-2 last:mb-0"
              style={{ background: "#36393f" }}
            >
              <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center font-bold text-white">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="text-white font-medium">Игрок {i + 1}</div>
                <div className="text-[#b9bbbe] text-sm">
                  {p.phase === "consolation"
                    ? `${CONSOLATION.emoji} ${CONSOLATION.label}`
                    : p.phase === "took" && p.pendingPrize
                    ? `${p.pendingPrize.emoji} ${p.pendingPrize.label}`
                    : p.phase === "took" && p.wonPrizes.length > 0
                    ? `${p.wonPrizes[p.wonPrizes.length - 1].emoji} ${p.wonPrizes[p.wonPrizes.length - 1].label}`
                    : "Ничего не выиграл"}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={resetGame}
          className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-8 py-3 rounded-xl font-semibold text-lg transition-colors"
        >
          🔄 Играть снова
        </button>
      </div>
    );
  }

  // ── Основной экран игры ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white overflow-x-hidden"
      style={{ background: "radial-gradient(ellipse at top, #1a0533 0%, #0d001a 60%, #000 100%)" }}
    >
      {/* Навбар */}
      <nav className="border-b border-purple-900/50 px-4 py-3" style={{ background: "rgba(26,5,51,0.9)", backdropFilter: "blur(10px)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#faa61a] rounded-full flex items-center justify-center text-xl">
              🎂
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Барабан Удачи</h1>
              <p className="text-xs text-[#b9bbbe]">С днём рождения! 🎉</p>
            </div>
          </div>

          {/* Переключатель игроков */}
          <div className="hidden sm:flex items-center gap-2">
            {players.map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  if (!spinning) {
                    setCurrentPlayerIndex(i);
                    setWheelAngle(0);
                    totalAngleRef.current = 0;
                  }
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
                style={{
                  borderColor:
                    i === currentPlayerIndex ? "#faa61a" : "#40444b",
                  background:
                    p.phase === "took" || p.phase === "consolation"
                      ? "#3ba55c"
                      : i === currentPlayerIndex
                      ? "#faa61a22"
                      : "#36393f",
                  color:
                    i === currentPlayerIndex ? "#faa61a" : "#8e9297",
                }}
              >
                {p.phase === "took" || p.phase === "consolation" ? "✓" : i + 1}
              </button>
            ))}
          </div>

          <button
            onClick={resetGame}
            className="text-[#8e9297] hover:text-white text-xs px-3 py-1.5 rounded border border-[#40444b] hover:border-[#8e9297] transition-all"
          >
            Заново
          </button>
        </div>
      </nav>

      {/* Макет Discord */}
      <div className="flex min-h-[calc(100vh-57px)]">
        {/* Боковая панель */}
        <div className="hidden lg:flex w-60 flex-col" style={{ background: "rgba(20,3,40,0.8)", borderRight: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="p-4" style={{ borderBottom: "1px solid rgba(139,92,246,0.2)" }}>
            <h2 className="text-white font-semibold">🎪 Праздник</h2>
          </div>
          <div className="flex-1 p-2">
            {/* Призы-«каналы» */}
            <div className="mb-3 px-2 py-1 text-[#8e9297] text-xs font-semibold uppercase tracking-wide">
              Призы
            </div>
            {PRIZES.map((pr, i) => {
              const inWindow = i === (player?.currentWindow ?? 0);
              return (
                <div
                  key={pr.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-sm mb-0.5 transition-colors"
                  style={{
                    background: inWindow ? pr.color + "22" : "transparent",
                    color: inWindow ? pr.color : "#8e9297",
                  }}
                >
                  <span>{pr.emoji}</span>
                  <span className="flex-1 truncate">{pr.label}</span>
                  <span className="text-xs opacity-70">{Math.round(pr.winChance * 100)}%</span>
                </div>
              );
            })}

            <div className="mt-4 px-2 py-1 text-[#8e9297] text-xs font-semibold uppercase tracking-wide">
              Гарантия
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[#8e9297]">
              <span>{CONSOLATION.emoji}</span>
              <span>Утешительный</span>
            </div>
          </div>

          {/* Пользователь */}
          <div className="p-2 flex items-center gap-2" style={{ background: "rgba(10,0,25,0.9)", borderTop: "1px solid rgba(139,92,246,0.2)" }}>
            <div className="w-8 h-8 bg-[#faa61a] rounded-full flex items-center justify-center font-bold text-sm text-[#2f3136]">
              {currentPlayerIndex + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium">Игрок {currentPlayerIndex + 1}</div>
              <div className="text-[#3ba55c] text-xs">● В игре</div>
            </div>
          </div>
        </div>

        {/* Центр */}
        <div className="flex-1 flex flex-col">
          {/* Заголовок канала */}
          <div className="h-12 flex items-center px-4 gap-2" style={{ background: "rgba(20,3,40,0.6)", borderBottom: "1px solid rgba(139,92,246,0.2)" }}>
            <span className="text-xl">🎰</span>
            <span className="text-white font-semibold">барабан</span>
            <div className="w-px h-5 bg-[#40444b] mx-2" />
            <span className="text-[#8e9297] text-sm hidden sm:block">
              Игрок {currentPlayerIndex + 1} · Прокрут {(player?.spinsUsed ?? 0) + 1}/{TOTAL_SPINS}
            </span>
          </div>

          {/* Контент */}
          <div className="flex-1 p-4 sm:p-6 flex flex-col items-center gap-6 overflow-y-auto">

            {/* Карточка текущего приза */}
            {player && (() => {
              const currentPrize = getPrizeForWindow(player.currentWindow);
              const img = PRIZE_IMAGES[currentPrize.id];
              return (
                <div
                  className="w-full max-w-sm rounded-xl p-4 text-center border overflow-hidden"
                  style={{
                    borderColor: currentPrize.color + "66",
                    background: currentPrize.color + "11",
                  }}
                >
                  {img ? (
                    <img
                      src={img}
                      alt={currentPrize.label}
                      className="w-32 h-32 object-cover rounded-xl mx-auto mb-3 border-2"
                      style={{ borderColor: currentPrize.color + "88" }}
                    />
                  ) : (
                    <div className="text-4xl mb-3">{currentPrize.emoji}</div>
                  )}
                  <div className="font-bold text-lg" style={{ color: currentPrize.color }}>
                    {currentPrize.label}
                  </div>
                  <div className="text-[#b9bbbe] text-sm mt-1">
                    Шанс выиграть: {Math.round(currentPrize.winChance * 100)}%
                  </div>
                </div>
              );
            })()}

            {/* Колесо + Рычаг */}
            <div className="flex items-center gap-4">
              <Wheel angle={wheelAngle} spinning={spinning} />
              {player && (player.phase === "idle" || player.phase === "spinning" || !player.phase) && (
                <Lever
                  onPull={spin}
                  disabled={spinning || player.spinsUsed >= TOTAL_SPINS}
                />
              )}
            </div>

            {/* Прогресс */}
            {player && (
              <div className="w-full max-w-sm">
                <SpinProgress player={player} />
              </div>
            )}

            {/* Кнопки действий */}
            {player && (
              <div className="w-full max-w-sm space-y-3">
                {/* Состояние: выиграли — берём или продолжаем */}
                {player.phase === "won" && player.pendingPrize && (
                  <div className="bg-[#2f3136] border border-[#faa61a] rounded-xl p-4 text-center">
                    {PRIZE_IMAGES[player.pendingPrize.id] ? (
                      <img
                        src={PRIZE_IMAGES[player.pendingPrize.id]}
                        alt={player.pendingPrize.label}
                        className="w-36 h-36 object-cover rounded-xl mx-auto mb-3 border-2 border-[#faa61a]"
                      />
                    ) : (
                      <div className="text-3xl mb-2">{player.pendingPrize.emoji}</div>
                    )}
                    <div className="text-white font-bold mb-1">
                      🎉 Выпало: {player.pendingPrize.label}!
                    </div>
                    <p className="text-[#b9bbbe] text-xs mb-4">
                      Взять приз сейчас или рискнуть на следующее окно?
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={takePrize}
                        className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all"
                        style={{ background: "#3ba55c", color: "#fff" }}
                      >
                        ✅ Взять приз!
                      </button>
                      {player.currentWindow < PRIZES.length - 1 ? (
                        <button
                          onClick={continueSpin}
                          className="flex-1 py-2.5 rounded-lg font-semibold text-sm border border-[#ed4245] text-[#ed4245] hover:bg-[#ed4245]/10 transition-all"
                        >
                          🎲 Рискнуть
                        </button>
                      ) : (
                        <button
                          onClick={takePrize}
                          className="flex-1 py-2.5 rounded-lg font-semibold text-sm border border-[#40444b] text-[#8e9297] cursor-not-allowed"
                          disabled
                        >
                          Это макс.
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Подсказка во время кручения */}
                {(player.phase === "idle" || player.phase === "spinning" || !player.phase) && spinning && (
                  <div className="w-full py-3 rounded-xl text-center font-bold text-lg"
                    style={{ background: "#40444b", color: "#fff" }}>
                    🌀 Крутится…
                  </div>
                )}

                {/* Утешительный */}
                {player.phase === "consolation" && (
                  <div className="bg-[#2f3136] border border-[#72767d] rounded-xl p-4 text-center">
                    <div className="text-4xl mb-2">🎁</div>
                    <div className="text-white font-bold mb-1">Утешительный приз!</div>
                    <p className="text-[#b9bbbe] text-sm mb-4">
                      Все прокруты использованы — ты получаешь утешительный подарок!
                    </p>
                    {playerCount! > currentPlayerIndex + 1 ? (
                      <button
                        onClick={nextPlayer}
                        className="w-full py-2.5 rounded-lg font-semibold bg-[#5865f2] text-white hover:bg-[#4752c4] transition-all"
                      >
                        Следующий игрок →
                      </button>
                    ) : null}
                  </div>
                )}

                {/* Взяли приз */}
                {player.phase === "took" && (
                  <div className="bg-[#2f3136] border border-[#3ba55c] rounded-xl p-4 text-center">
                    <div className="text-4xl mb-2">🎊</div>
                    <div className="text-[#3ba55c] font-bold mb-1">Приз получен!</div>
                    <p className="text-[#b9bbbe] text-sm mb-4">
                      {player.wonPrizes[player.wonPrizes.length - 1]?.emoji}{" "}
                      {player.wonPrizes[player.wonPrizes.length - 1]?.label}
                    </p>
                    {playerCount! > currentPlayerIndex + 1 ? (
                      <button
                        onClick={nextPlayer}
                        className="w-full py-2.5 rounded-lg font-semibold bg-[#5865f2] text-white hover:bg-[#4752c4] transition-all"
                      >
                        Следующий игрок →
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Лог */}
            {player && (
              <div className="w-full max-w-sm">
                <div className="text-[#8e9297] text-xs font-semibold uppercase tracking-wide mb-2">
                  Лог игры
                </div>
                <GameLog messages={player.log} />
              </div>
            )}
          </div>

          {/* Поле сообщения (декор) */}
          <div className="p-3 sm:p-4">
            <div className="rounded-lg px-4 py-2.5 text-purple-400/50 text-sm" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
              Сообщение #барабан
            </div>
          </div>
        </div>

        {/* Правая панель — участники */}
        <div className="hidden xl:block w-56 p-4" style={{ background: "rgba(20,3,40,0.8)", borderLeft: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="text-[#8e9297] text-xs font-semibold uppercase tracking-wide mb-3">
            Игроки — {playerCount}
          </div>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-[#36393f] transition-colors"
                onClick={() => {
                  if (!spinning) {
                    setCurrentPlayerIndex(i);
                    setWheelAngle(0);
                    totalAngleRef.current = 0;
                  }
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm relative"
                  style={{
                    background:
                      p.phase === "took" || p.phase === "consolation"
                        ? "#3ba55c"
                        : i === currentPlayerIndex
                        ? "#faa61a"
                        : "#40444b",
                    color: "#fff",
                  }}
                >
                  {p.phase === "took" || p.phase === "consolation" ? "✓" : i + 1}
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2f3136]"
                    style={{
                      background:
                        p.phase === "took" || p.phase === "consolation"
                          ? "#3ba55c"
                          : i === currentPlayerIndex
                          ? "#faa61a"
                          : "#8e9297",
                    }}
                  />
                </div>
                <div>
                  <div
                    className="text-sm font-medium"
                    style={{
                      color: i === currentPlayerIndex ? "#faa61a" : "#dcddde",
                    }}
                  >
                    Игрок {i + 1}
                  </div>
                  <div className="text-[#b9bbbe] text-xs">
                    {p.phase === "took"
                      ? `🏆 ${p.wonPrizes[p.wonPrizes.length - 1]?.label ?? "Приз"}`
                      : p.phase === "consolation"
                      ? "🎁 Утешительный"
                      : `${p.spinsUsed}/${TOTAL_SPINS} прокр.`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}