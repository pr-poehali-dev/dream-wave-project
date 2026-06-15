import { useState, useEffect, useRef } from "react";

// ── Призы ────────────────────────────────────────────────────────────────────
interface Prize {
  id: number;
  label: string;
  emoji: string;
  color: string;
  winChance: number;
  symbol: string; // символ на барабане
}

const PRIZES: Prize[] = [
  { id: 1, label: "Чупачупс",              emoji: "🍭", color: "#ed4245", winChance: 0.75, symbol: "cherry"  },
  { id: 2, label: "Органайзер для мелочей", emoji: "🗂️", color: "#5865f2", winChance: 0.45, symbol: "lemon"   },
  { id: 3, label: "Яблокорезка",            emoji: "🍎", color: "#faa61a", winChance: 0.35, symbol: "apple"   },
  { id: 4, label: "Ролик для одежды",       emoji: "🧹", color: "#3ba55c", winChance: 0.15, symbol: "grape"   },
  { id: 5, label: "Косметичка стильная",    emoji: "👜", color: "#eb459e", winChance: 0.05, symbol: "seven"   },
];

const PRIZE_IMAGES: Record<number, string> = {
  1: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/files/e688d9dc-8d43-410e-a4a6-413e3da0a0fa.jpg",
  2: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/bucket/5c9ce5b3-e991-4669-9848-87f8d2c2e4ec.png",
  3: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/bucket/3265aa2f-2583-414e-b309-bddc21ae2a40.png",
  4: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/bucket/aa328fab-8027-40e3-9dc6-cd015602bb78.png",
  5: "https://cdn.poehali.dev/projects/11983691-d48b-4eb3-8a0a-bdc07568f7f6/bucket/769fc24c-1ac5-4957-a020-c147188c60da.png",
};

const CONSOLATION = { label: "Чупачупс", emoji: "🍭", color: "#ed4245" };
const TOTAL_SPINS = 25;
const WINDOW_SIZE = 5;

// Символы на барабанах (8 штук, повторяются)
const REEL_SYMBOLS = ["🍎","🍋","❤️","🍒","🎰","🔔","7️⃣","🍇","🍉","⭐"];

const WIN_SOUND_URL = "https://cdn.discordapp.com/attachments/1407625036667293818/1515959445455114270/GameboyJones_-_HIT_THE_JACKPOT_Hakari_Dance_80967376_cut_17sec.mp3?ex=6a30e6c0&is=6a2f9540&hm=db43b7fda22bf85f0f1e7c8674573263f7b144500dd4cc7705a2680822af3184&";

function playWinSound() {
  const audio = new Audio(WIN_SOUND_URL);
  audio.volume = 0.8;
  audio.play().catch(() => null);
}

// ── Типы ──────────────────────────────────────────────────────────────────────
type GamePhase = "idle" | "spinning" | "won" | "took" | "consolation";

interface PlayerState {
  spinsUsed: number;
  currentWindow: number;
  spinsInWindow: number;
  wonPrizes: Prize[];
  pendingPrize: Prize | null;
  phase: GamePhase;
  log: string[];
}

function makePlayer(): PlayerState {
  return { spinsUsed: 0, currentWindow: 0, spinsInWindow: 0, wonPrizes: [], pendingPrize: null, phase: "idle", log: [] };
}

function getPrizeForWindow(w: number): Prize {
  return PRIZES[Math.max(0, Math.min(w, PRIZES.length - 1))];
}

// ── Один барабан ──────────────────────────────────────────────────────────────
function Reel({ symbols, spinning, finalIndex, delay }: {
  symbols: string[];
  spinning: boolean;
  finalIndex: number;
  delay: number;
}) {
  const ITEM_H = 90;
  const visible = 3;
  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevSpinning = useRef(false);

  useEffect(() => {
    if (spinning && !prevSpinning.current) {
      setIsAnimating(true);
    }
    if (!spinning && prevSpinning.current) {
      setTimeout(() => {
        setOffset(finalIndex * ITEM_H);
        setTimeout(() => setIsAnimating(false), 400);
      }, delay);
    }
    prevSpinning.current = spinning;
  }, [spinning, finalIndex, delay]);

  const loopedSymbols = [...symbols, ...symbols, ...symbols];
  const translateY = isAnimating
    ? undefined
    : -(offset % (symbols.length * ITEM_H));

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        width: 100,
        height: ITEM_H * visible,
        background: "linear-gradient(180deg, #0a001a 0%, #1a0533 50%, #0a001a 100%)",
        border: "2px solid rgba(0,220,255,0.4)",
        boxShadow: "inset 0 0 20px rgba(0,0,0,0.8), 0 0 10px rgba(0,200,255,0.2)",
      }}
    >
      {/* Подсветка центральной строки */}
      <div className="absolute inset-x-0 z-10 pointer-events-none" style={{
        top: ITEM_H,
        height: ITEM_H,
        background: "linear-gradient(180deg, rgba(0,200,255,0.08) 0%, rgba(0,200,255,0.15) 50%, rgba(0,200,255,0.08) 100%)",
        borderTop: "1px solid rgba(0,220,255,0.4)",
        borderBottom: "1px solid rgba(0,220,255,0.4)",
      }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          transform: translateY !== undefined ? `translateY(${translateY}px)` : undefined,
          transition: isAnimating ? "none" : "transform 0.3s ease-out",
          animation: isAnimating ? `reelSpin 0.15s linear infinite` : "none",
        }}
      >
        {loopedSymbols.map((sym, i) => (
          <div
            key={i}
            style={{
              height: ITEM_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              flexShrink: 0,
            }}
          >
            {sym}
          </div>
        ))}
      </div>

      {/* Верхняя/нижняя тени */}
      <div className="absolute inset-x-0 top-0 h-16 pointer-events-none z-10" style={{
        background: "linear-gradient(180deg, #0a001a 0%, transparent 100%)"
      }} />
      <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none z-10" style={{
        background: "linear-gradient(0deg, #0a001a 0%, transparent 100%)"
      }} />
    </div>
  );
}

// ── Рычаг ─────────────────────────────────────────────────────────────────────
function Lever({ onPull, disabled }: { onPull: () => void; disabled: boolean }) {
  const [pulled, setPulled] = useState(false);

  function handlePull() {
    if (disabled || pulled) return;
    setPulled(true);
    onPull();
    setTimeout(() => setPulled(false), 700);
  }

  return (
    <div className="flex flex-col items-center cursor-pointer select-none" onClick={handlePull} style={{ width: 50 }}>
      {/* Шар */}
      <div className="transition-all duration-300 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
        style={{
          transform: pulled ? "translateY(70px)" : "translateY(0)",
          background: pulled
            ? "radial-gradient(circle at 35% 35%, #ff6b6b, #c0392b)"
            : "radial-gradient(circle at 35% 35%, #ff9999, #e74c3c)",
          boxShadow: pulled ? "0 2px 8px rgba(231,76,60,0.5)" : "0 0 20px rgba(231,76,60,0.8), 0 4px 16px rgba(0,0,0,0.4)",
        }}>
        🎰
      </div>
      {/* Стержень */}
      <div className="rounded-full" style={{
        width: 10,
        height: pulled ? 30 : 100,
        marginTop: pulled ? -30 : 0,
        background: "linear-gradient(180deg, #bbb 0%, #888 50%, #bbb 100%)",
        boxShadow: "2px 0 6px rgba(0,0,0,0.5)",
        transition: "height 0.3s, margin-top 0.3s",
      }} />
      {/* Основание */}
      <div className="rounded-lg" style={{
        width: 26,
        height: 36,
        background: "linear-gradient(180deg, #666 0%, #333 100%)",
        boxShadow: "0 4px 8px rgba(0,0,0,0.6)",
      }} />
      <div className="text-xs mt-2 font-bold" style={{
        color: disabled ? "rgba(255,255,255,0.2)" : "#00e5ff",
        textShadow: disabled ? "none" : "0 0 8px rgba(0,200,255,0.8)",
      }}>
        {disabled ? "⏳" : "PULL"}
      </div>
    </div>
  );
}

// ── Слот-машина ───────────────────────────────────────────────────────────────
function SlotMachine({ onSpin, spinning, reelResults, showResult, winPrize }: {
  onSpin: () => void;
  spinning: boolean;
  reelResults: number[];
  showResult: boolean;
  winPrize: Prize | null;
}) {
  const isWin = showResult && winPrize !== null;

  return (
    <div className="relative flex flex-col items-center">

      {/* Корпус машины */}
      <div className="relative" style={{
        background: "linear-gradient(180deg, #8B4513 0%, #6B3410 40%, #4a2008 100%)",
        borderRadius: "24px 24px 12px 12px",
        padding: "0 20px 20px",
        boxShadow: "0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(0,0,0,0.5)",
        border: "3px solid #c8860a",
      }}>

        {/* Арка сверху */}
        <div className="flex items-center justify-center py-4 relative">
          <div className="absolute inset-0 rounded-t-2xl" style={{
            background: "linear-gradient(180deg, #ffd700 0%, #c8860a 100%)",
            margin: "-3px -3px 0",
            borderRadius: "21px 21px 0 0",
          }} />
          <div className="relative z-10 text-center">
            <div className="font-black italic" style={{
              fontSize: 18,
              color: "#c0392b",
              textShadow: "0 0 10px rgba(192,57,43,0.8), 2px 2px 0 #8b0000",
              fontFamily: "serif",
            }}>Mega</div>
            <div className="font-black" style={{
              fontSize: 28,
              color: "#ffd700",
              textShadow: "0 0 15px rgba(255,215,0,0.8), 2px 2px 0 #8B4513",
              letterSpacing: 4,
              fontFamily: "serif",
            }}>SLOTS</div>
          </div>
          {/* Лампочки по арке */}
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="absolute w-3 h-3 rounded-full animate-pulse"
              style={{
                background: i % 2 === 0 ? "#fff" : "#ffd700",
                boxShadow: `0 0 6px ${i % 2 === 0 ? "#fff" : "#ffd700"}`,
                left: `${8 + i * 10}%`,
                top: 6,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* Окно барабанов */}
        <div className="rounded-xl p-3 mb-3" style={{
          background: "linear-gradient(135deg, #c8860a, #ffd700, #c8860a)",
          boxShadow: "0 0 20px rgba(200,134,10,0.6)",
          border: "3px solid #ffd700",
        }}>
          <div className="rounded-lg p-2 flex gap-2" style={{
            background: "#0a001a",
            boxShadow: "inset 0 0 30px rgba(0,0,0,0.9)",
          }}>
            {[0, 1, 2].map((ri) => (
              <Reel
                key={ri}
                symbols={REEL_SYMBOLS}
                spinning={spinning}
                finalIndex={reelResults[ri] ?? 0}
                delay={ri * 300}
              />
            ))}
          </div>
        </div>

        {/* Панель JACKPOT */}
        <div className="flex items-center justify-center py-2 px-4 rounded-lg mb-4" style={{
          background: "#111",
          border: "2px solid #ffd700",
          boxShadow: isWin
            ? "0 0 20px rgba(255,215,0,0.8), inset 0 0 10px rgba(255,215,0,0.2)"
            : "0 0 10px rgba(0,0,0,0.5)",
        }}>
          <span className="font-black tracking-widest" style={{
            fontSize: 22,
            color: isWin ? "#ffd700" : "#555",
            textShadow: isWin ? "0 0 15px rgba(255,215,0,1)" : "none",
            fontFamily: "serif",
            transition: "all 0.3s",
          }}>
            {isWin ? "🎉 JACKPOT! 🎉" : "JACKPOT"}
          </span>
        </div>

        {/* Кнопки внизу */}
        <div className="flex gap-4 justify-center">
          {[
            { color: "#3b82f6", shadow: "#3b82f6" },
            { color: "#888", shadow: "#888" },
            { color: "#ef4444", shadow: "#ef4444" },
          ].map((btn, i) => (
            <div key={i} className="w-10 h-10 rounded-full border-4 border-black"
              style={{ background: btn.color, boxShadow: `0 4px 0 rgba(0,0,0,0.5), 0 0 10px ${btn.shadow}44` }}
            />
          ))}
        </div>
      </div>

      {/* Рычаг сбоку */}
      <div className="absolute" style={{ right: -60, top: 80 }}>
        <Lever onPull={onSpin} disabled={spinning} />
      </div>
    </div>
  );
}

// ── Лог ──────────────────────────────────────────────────────────────────────
function GameLog({ messages }: { messages: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  return (
    <div ref={ref} className="rounded-xl p-3 space-y-1 overflow-y-auto" style={{
      maxHeight: 130,
      background: "rgba(10,0,30,0.8)",
      border: "1px solid rgba(235,69,158,0.4)",
      boxShadow: "0 0 16px rgba(235,69,158,0.15)",
    }}>
      {messages.length === 0 && <p className="text-xs" style={{ color: "rgba(0,200,255,0.5)" }}>Дёрни рычаг — и начнём! 🎰</p>}
      {messages.map((m, i) => (
        <p key={i} className="text-xs leading-relaxed" style={{
          color: m.includes("🎉") || m.includes("✅") ? "#4ade80"
               : m.includes("➡️") ? "#f59e0b"
               : "#c4b5fd",
        }}>{m}</p>
      ))}
    </div>
  );
}

// ── Прогресс окон ─────────────────────────────────────────────────────────────
function SpinProgress({ player }: { player: PlayerState }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(196,181,253,0.7)" }}>
        <span>Прокруты: {player.spinsUsed}/{TOTAL_SPINS}</span>
        <span>Окно {player.currentWindow + 1}/5</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{
          width: `${(player.spinsUsed / TOTAL_SPINS) * 100}%`,
          background: "linear-gradient(90deg, #00e5ff, #a855f7)",
        }} />
      </div>
      <div className="flex gap-1 mt-2">
        {Array.from({ length: 5 }).map((_, wi) => {
          const pr = getPrizeForWindow(wi);
          const isPast = wi < player.currentWindow;
          const isCurrent = wi === player.currentWindow;
          return (
            <div key={wi} className="flex-1 rounded text-center py-1 text-xs font-semibold border" style={{
              borderColor: isCurrent ? pr.color : "rgba(255,255,255,0.1)",
              background: isCurrent ? pr.color + "22" : isPast ? "rgba(0,0,0,0.3)" : "transparent",
              color: isCurrent ? pr.color : isPast ? "#444" : "rgba(255,255,255,0.4)",
              boxShadow: isCurrent ? `0 0 8px ${pr.color}44` : "none",
            }}>
              {pr.emoji}
              <div style={{ fontSize: 9 }}>{Math.round(pr.winChance * 100)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Главный компонент ─────────────────────────────────────────────────────────
export default function Index() {
  const [started, setStarted] = useState(false);
  const [player, setPlayer] = useState<PlayerState>(makePlayer());
  const [spinning, setSpinning] = useState(false);
  const [reelResults, setReelResults] = useState([0, 0, 0]);
  const [showResult, setShowResult] = useState(false);
  const [winPrize, setWinPrize] = useState<Prize | null>(null);

  function updatePlayer(fn: (p: PlayerState) => PlayerState) {
    setPlayer(prev => fn(prev));
  }

  function spin() {
    if (spinning || player.phase === "won") return;

    setSpinning(true);
    setShowResult(false);
    setWinPrize(null);

    // Случайные индексы для барабанов
    const r1 = Math.floor(Math.random() * REEL_SYMBOLS.length);
    const prize = getPrizeForWindow(player.currentWindow);
    const roll = Math.random();
    const won = roll < prize.winChance;

    // Если победа — делаем два барабана одинаковыми (визуально "совпадение")
    let r2: number, r3: number;
    if (won) {
      r2 = r1;
      r3 = r1;
    } else {
      r2 = (r1 + 1 + Math.floor(Math.random() * (REEL_SYMBOLS.length - 1))) % REEL_SYMBOLS.length;
      r3 = (r1 + 2 + Math.floor(Math.random() * (REEL_SYMBOLS.length - 2))) % REEL_SYMBOLS.length;
    }

    setReelResults([r1, r2, r3]);

    setTimeout(() => {
      setSpinning(false);
      setShowResult(true);

      setPlayer(prev => {
        const newSpinsUsed = prev.spinsUsed + 1;
        const newSpinsInWindow = prev.spinsInWindow + 1;
        const log = [...prev.log];

        log.push(`Прокрут #${newSpinsUsed} (окно ${prev.currentWindow + 1}, шанс ${Math.round(prize.winChance * 100)}%) — ${won ? "🎉 ВЫИГРЫШ!" : "не выпало"}`);

        if (won) {
          playWinSound();
          setWinPrize(prize);
          return { ...prev, spinsUsed: newSpinsUsed, spinsInWindow: newSpinsInWindow, pendingPrize: prize, wonPrizes: [...prev.wonPrizes, prize], phase: "won", log };
        }

        if (newSpinsInWindow >= WINDOW_SIZE) {
          const nextWindow = prev.currentWindow + 1;
          if (newSpinsUsed >= TOTAL_SPINS || nextWindow >= PRIZES.length) {
            log.push(`🎁 Все прокруты использованы! Получаешь утешительный приз.`);
            return { ...prev, spinsUsed: newSpinsUsed, spinsInWindow: 0, phase: "consolation", log };
          }
          log.push(`➡️ Следующее окно: ${getPrizeForWindow(nextWindow).emoji} ${getPrizeForWindow(nextWindow).label}`);
          return { ...prev, spinsUsed: newSpinsUsed, spinsInWindow: 0, currentWindow: nextWindow, log };
        }

        return { ...prev, spinsUsed: newSpinsUsed, spinsInWindow: newSpinsInWindow, log };
      });
    }, 2800);
  }

  function takePrize() {
    updatePlayer(p => {
      const log = [...p.log, `✅ Приз забран: ${p.pendingPrize?.emoji} ${p.pendingPrize?.label}!`];
      return { ...p, phase: "took", log };
    });
  }

  function continueSpin() {
    const nextWindow = player.currentWindow + 1;
    if (nextWindow >= PRIZES.length || player.spinsUsed >= TOTAL_SPINS) {
      updatePlayer(p => ({ ...p, phase: "consolation", pendingPrize: null }));
    } else {
      updatePlayer(p => ({
        ...p, phase: "idle", pendingPrize: null,
        currentWindow: nextWindow, spinsInWindow: 0,
        log: [...p.log, `🎲 Рискуем! Следующий приз: ${getPrizeForWindow(nextWindow).emoji} ${getPrizeForWindow(nextWindow).label}`],
      }));
    }
    setShowResult(false);
    setWinPrize(null);
  }

  function reset() {
    setStarted(false);
    setPlayer(makePlayer());
    setSpinning(false);
    setReelResults([0, 0, 0]);
    setShowResult(false);
    setWinPrize(null);
  }

  // ── Стартовый экран ────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
        style={{ background: "radial-gradient(ellipse at top, #1a0533 0%, #0d001a 60%, #000 100%)" }}>
        {["🎉","✨","🎊","🍭","🎁","⭐","🎈","💫","🎀","🌟"].map((em, i) => (
          <div key={i} className="absolute text-3xl pointer-events-none animate-bounce" style={{
            left: `${5 + i * 9}%`, top: `${10 + (i % 3) * 25}%`,
            animationDelay: `${i * 0.3}s`, animationDuration: `${1.5 + (i % 3) * 0.5}s`, opacity: 0.7,
          }}>{em}</div>
        ))}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(235,69,158,0.25) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(88,101,242,0.25) 0%, transparent 70%)" }} />

        <div className="relative z-10 text-center">
          <div className="text-8xl mb-6" style={{ filter: "drop-shadow(0 0 30px rgba(250,166,26,0.8))" }}>🎂</div>
          <h1 className="text-5xl sm:text-6xl font-bold mb-3" style={{
            background: "linear-gradient(135deg, #faa61a, #eb459e, #5865f2)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Барабан Удачи</h1>
          <p className="text-pink-200 text-xl mb-12 font-medium">С днём рождения, мамочка! 🎉</p>
          <button onClick={() => setStarted(true)}
            className="px-16 py-5 rounded-2xl font-bold text-2xl text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #eb459e, #faa61a)",
              boxShadow: "0 0 40px rgba(235,69,158,0.6), 0 8px 32px rgba(0,0,0,0.4)",
            }}>
            🎰 Играть!
          </button>
          <p className="text-purple-300 text-sm mt-6 opacity-70">5 призов · 25 прокрутов</p>
        </div>
      </div>
    );
  }

  // ── Финальный экран ───────────────────────────────────────────────────────
  if (player.phase === "took" || player.phase === "consolation") {
    const finalPrize = player.phase === "consolation" ? CONSOLATION : player.wonPrizes[player.wonPrizes.length - 1];
    const img = player.phase !== "consolation" && player.wonPrizes.length > 0
      ? PRIZE_IMAGES[player.wonPrizes[player.wonPrizes.length - 1].id]
      : null;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: "radial-gradient(ellipse at top, #1a0533 0%, #0d001a 60%, #000 100%)" }}>
        <div className="text-center">
          <div className="text-6xl mb-4">{player.phase === "consolation" ? "🎁" : "🏆"}</div>
          <h1 className="text-3xl font-bold text-white mb-2">{player.phase === "consolation" ? "Утешительный приз!" : "Поздравляем!"}</h1>
          {img && <img src={img} alt={finalPrize.label} className="w-40 h-40 object-cover rounded-2xl mx-auto my-4 border-2" style={{ borderColor: "rgba(0,220,255,0.6)", boxShadow: "0 0 20px rgba(0,200,255,0.4)" }} />}
          <div className="text-2xl font-bold mb-6" style={{ color: "#00e5ff", textShadow: "0 0 10px rgba(0,200,255,0.8)" }}>
            {finalPrize.emoji} {finalPrize.label}
          </div>
          <button onClick={reset}
            className="px-8 py-3 rounded-xl font-bold text-lg text-white"
            style={{ background: "linear-gradient(135deg, #eb459e, #faa61a)", boxShadow: "0 0 20px rgba(235,69,158,0.5)" }}>
            🔄 Играть снова
          </button>
        </div>
      </div>
    );
  }

  // ── Основной экран ────────────────────────────────────────────────────────
  const currentPrize = getPrizeForWindow(player.currentWindow);

  return (
    <div className="min-h-screen text-white overflow-x-hidden"
      style={{ background: "radial-gradient(ellipse at top, #1a0533 0%, #0d001a 60%, #000 100%)" }}>

      {/* Навбар */}
      <nav className="border-b px-4 py-3 flex items-center justify-between"
        style={{ background: "rgba(26,5,51,0.9)", borderColor: "rgba(139,92,246,0.3)", backdropFilter: "blur(10px)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl"
            style={{ background: "linear-gradient(135deg, #faa61a, #eb459e)" }}>🎂</div>
          <div>
            <h1 className="text-lg font-bold text-white">Барабан Удачи</h1>
            <p className="text-xs" style={{ color: "rgba(196,181,253,0.7)" }}>С днём рождения! 🎉</p>
          </div>
        </div>
        <button onClick={reset} className="text-xs px-3 py-1.5 rounded border transition-all"
          style={{ color: "rgba(196,181,253,0.6)", borderColor: "rgba(139,92,246,0.3)" }}>
          Заново
        </button>
      </nav>

      <div className="flex min-h-[calc(100vh-57px)]">

        {/* Боковая панель */}
        <div className="hidden lg:flex w-60 flex-col" style={{ background: "rgba(20,3,40,0.8)", borderRight: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="p-4 relative overflow-hidden" style={{ borderBottom: "1px solid rgba(139,92,246,0.3)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(235,69,158,0.15), rgba(88,101,242,0.1))" }} />
            <div className="relative">
              <h2 className="font-bold text-base" style={{
                background: "linear-gradient(135deg, #faa61a, #eb459e)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>🎪 Праздник</h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(168,85,247,0.6)" }}>День рождения мамочки 🎂</p>
            </div>
          </div>

          <div className="flex-1 p-2">
            <div className="mb-2 px-2 py-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(168,85,247,0.7)" }}>
              ✨ Призы
            </div>
            {PRIZES.map((pr, i) => {
              const inWindow = i === player.currentWindow;
              return (
                <div key={pr.id} className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm mb-1 transition-all" style={{
                  background: inWindow ? `${pr.color}25` : "rgba(255,255,255,0.03)",
                  color: inWindow ? pr.color : "#fff",
                  border: inWindow ? `1px solid ${pr.color}88` : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: inWindow ? `0 0 14px ${pr.color}44` : "none",
                  textShadow: inWindow ? `0 0 8px ${pr.color}` : "0 0 6px rgba(255,255,255,0.2)",
                }}>
                  <span className="text-base">{pr.emoji}</span>
                  <span className="flex-1 truncate text-xs font-medium">{pr.label}</span>
                  <span className="text-xs font-bold" style={{ color: inWindow ? pr.color : "rgba(255,255,255,0.4)" }}>
                    {Math.round(pr.winChance * 100)}%
                  </span>
                </div>
              );
            })}
            <div className="mt-3 mb-1 px-2 py-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(168,85,247,0.7)" }}>
              🎁 Гарантия
            </div>
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              <span>{CONSOLATION.emoji}</span><span className="text-xs">Утешительный приз</span>
            </div>
          </div>

          <div className="p-2 flex items-center gap-2" style={{ background: "rgba(10,0,25,0.9)", borderTop: "1px solid rgba(139,92,246,0.2)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #faa61a, #eb459e)", color: "#1a0533" }}>🎂</div>
            <div>
              <div className="text-white text-sm font-medium">Игрок</div>
              <div className="text-xs" style={{ color: "#3ba55c" }}>● В игре</div>
            </div>
          </div>
        </div>

        {/* Центр */}
        <div className="flex-1 flex flex-col">
          <div className="h-12 flex items-center px-4 gap-2"
            style={{ background: "rgba(20,3,40,0.6)", borderBottom: "1px solid rgba(139,92,246,0.2)" }}>
            <span className="text-xl">🎰</span>
            <span className="text-white font-semibold">слоты</span>
            <div className="w-px h-5 mx-2" style={{ background: "rgba(139,92,246,0.4)" }} />
            <span className="text-sm hidden sm:block" style={{ color: "rgba(168,85,247,0.7)" }}>
              Прокрут {player.spinsUsed + 1}/{TOTAL_SPINS} · Разыгрывается: {currentPrize.emoji} {currentPrize.label}
            </span>
          </div>

          <div className="flex-1 p-4 sm:p-6 flex flex-col items-center gap-5 overflow-y-auto">

            {/* Текущий приз */}
            <div className="rounded-xl px-6 py-3 text-center border" style={{
              borderColor: currentPrize.color + "66",
              background: currentPrize.color + "11",
              boxShadow: `0 0 20px ${currentPrize.color}22`,
            }}>
              <span className="text-2xl mr-2">{currentPrize.emoji}</span>
              <span className="font-bold" style={{ color: currentPrize.color }}>{currentPrize.label}</span>
              <span className="text-sm ml-3" style={{ color: "rgba(255,255,255,0.5)" }}>· шанс {Math.round(currentPrize.winChance * 100)}%</span>
            </div>

            {/* Слот-машина */}
            <div className="my-2">
              <SlotMachine
                onSpin={spin}
                spinning={spinning}
                reelResults={reelResults}
                showResult={showResult}
                winPrize={winPrize}
              />
            </div>

            {/* Прогресс */}
            <div className="w-full max-w-sm">
              <SpinProgress player={player} />
            </div>

            {/* Кнопки */}
            <div className="w-full max-w-sm space-y-3">

              {/* Крутится */}
              {spinning && (
                <div className="w-full py-4 rounded-xl text-center font-bold text-lg" style={{
                  background: "linear-gradient(135deg, rgba(0,200,255,0.15), rgba(0,100,255,0.1))",
                  border: "1px solid rgba(0,220,255,0.5)",
                  color: "#00e5ff",
                  boxShadow: "0 0 20px rgba(0,200,255,0.3)",
                  textShadow: "0 0 10px rgba(0,200,255,0.8)",
                }}>
                  🌀 Крутится…
                </div>
              )}

              {/* Выиграли */}
              {player.phase === "won" && player.pendingPrize && (
                <div className="rounded-xl p-4 text-center" style={{
                  background: "linear-gradient(135deg, rgba(0,50,80,0.95), rgba(0,20,60,0.95))",
                  border: "1px solid rgba(0,220,255,0.6)",
                  boxShadow: "0 0 30px rgba(0,200,255,0.3), 0 0 60px rgba(0,100,255,0.15)",
                }}>
                  {PRIZE_IMAGES[player.pendingPrize.id] ? (
                    <img src={PRIZE_IMAGES[player.pendingPrize.id]} alt={player.pendingPrize.label}
                      className="w-36 h-36 object-cover rounded-xl mx-auto mb-3"
                      style={{ border: "2px solid rgba(0,220,255,0.8)", boxShadow: "0 0 16px rgba(0,200,255,0.5)" }} />
                  ) : (
                    <div className="text-4xl mb-3">{player.pendingPrize.emoji}</div>
                  )}
                  <div className="font-bold text-lg mb-1" style={{ color: "#00e5ff", textShadow: "0 0 10px rgba(0,200,255,0.8)" }}>
                    🎉 {player.pendingPrize.label}!
                  </div>
                  <p className="text-xs mb-4" style={{ color: "rgba(0,200,255,0.6)" }}>
                    Взять приз сейчас или рискнуть на следующее окно?
                  </p>
                  <div className="flex gap-3">
                    <button onClick={takePrize} className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all" style={{
                      background: "linear-gradient(135deg, rgba(0,180,255,0.3), rgba(0,100,255,0.2))",
                      border: "1px solid rgba(0,220,255,0.7)",
                      color: "#00e5ff",
                      boxShadow: "0 0 14px rgba(0,200,255,0.4)",
                    }}>
                      ✅ Взять приз!
                    </button>
                    {player.currentWindow < PRIZES.length - 1 ? (
                      <button onClick={continueSpin} className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all" style={{
                        background: "rgba(0,50,255,0.15)",
                        border: "1px solid rgba(0,150,255,0.5)",
                        color: "#60b4ff",
                        boxShadow: "0 0 10px rgba(0,100,255,0.3)",
                      }}>
                        🎲 Рискнуть
                      </button>
                    ) : (
                      <button disabled className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{
                        border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.2)"
                      }}>Макс. приз</button>
                    )}
                  </div>
                </div>
              )}

              {/* Лог */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "rgba(168,85,247,0.7)" }}>
                  Лог игры
                </div>
                <GameLog messages={player.log} />
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            <div className="rounded-lg px-4 py-2.5 text-sm" style={{
              background: "rgba(139,92,246,0.1)",
              border: "1px solid rgba(139,92,246,0.2)",
              color: "rgba(168,85,247,0.4)",
            }}>Сообщение #слоты</div>
          </div>
        </div>

        {/* Правая панель */}
        <div className="hidden xl:block w-52 p-4" style={{ background: "rgba(20,3,40,0.8)", borderLeft: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "rgba(168,85,247,0.7)" }}>
            Комбинации
          </div>
          {PRIZES.map((pr) => (
            <div key={pr.id} className="mb-2 p-2 rounded-lg" style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div className="text-xs font-bold mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                3× {pr.emoji}
              </div>
              <div className="text-xs" style={{ color: pr.color }}>{pr.label}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{Math.round(pr.winChance * 100)}% шанс</div>
            </div>
          ))}
        </div>

      </div>

      {/* CSS анимация барабана */}
      <style>{`
        @keyframes reelSpin {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-${90 * REEL_SYMBOLS.length}px); }
        }
      `}</style>
    </div>
  );
}
