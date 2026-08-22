import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Square, Pause, Play } from "lucide-react";

export function ActiveTimerBadge() {
  const { activeTimer, pauseTimer, resumeTimer, stopTimer } = useApp();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeTimer) return;
    const id = setInterval(() => {
      if (!activeTimer.paused) {
        setElapsed(Math.floor((Date.now() - activeTimer.startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  if (!activeTimer) return null;

  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="bg-indigo-600 text-white rounded-lg p-2.5 text-xs">
      <div className="font-medium truncate mb-1.5">{activeTimer.moduleName}</div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold">{fmt(elapsed)}</span>
        <div className="flex gap-1">
          <button
            onClick={activeTimer.paused ? resumeTimer : pauseTimer}
            aria-label={activeTimer.paused ? "继续计时" : "暂停计时"}
            className="w-9 h-9 flex items-center justify-center bg-indigo-500 hover:bg-indigo-400 rounded-lg"
          >
            {activeTimer.paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
          <button
            onClick={() => stopTimer()}
            aria-label="完成计时"
            className="w-9 h-9 flex items-center justify-center bg-red-500 hover:bg-red-400 rounded-lg"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
