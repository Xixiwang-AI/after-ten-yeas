import { useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, CalendarCheck, Clock, TrendingUp, TrendingDown, Minus,
  Edit3, Check, X, BookOpen, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0分";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}分`;
}

function formatTime(isoStr) {
  try { return format(parseISO(isoStr), "HH:mm"); } catch { return "--"; }
}

export default function DailyReview() {
  const { plans, timeLogs, updateTimeLog, deleteTimeLog, getLogsForDate } = useApp();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editLog, setEditLog] = useState(null);
  const [editForm, setEditForm] = useState({});

  const changeDate = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const dayLogs = getLogsForDate(selectedDate);
  const totalActual = dayLogs.reduce((s, l) => s + (l.duration || 0), 0);

  // Module-level comparison
  const moduleComparison = useMemo(() => {
    const modMap = {};
    dayLogs.forEach(log => {
      const key = log.moduleId || "other";
      if (!modMap[key]) {
        modMap[key] = {
          moduleId: key,
          moduleName: log.moduleName || "未知模块",
          actual: 0,
          estimated: 0,
        };
        // Find estimated hours
        const mod = plans.flatMap(p => p.modules).find(m => m.id === key);
        if (mod) modMap[key].estimated = (mod.estimatedHours || 0) * 3600;
      }
      modMap[key].actual += log.duration || 0;
    });
    return Object.values(modMap);
  }, [dayLogs, plans]);

  const chartData = moduleComparison.map(m => ({
    name: m.moduleName.length > 6 ? m.moduleName.slice(0, 6) + "…" : m.moduleName,
    实际: +(m.actual / 3600).toFixed(1),
    计划: +(m.estimated / 3600).toFixed(1),
    fullName: m.moduleName,
  }));

  const handleSaveEdit = () => {
    if (!editLog) return;
    updateTimeLog(editLog.id, {
      notes: editForm.notes,
      duration: editForm.duration ? +editForm.duration : editLog.duration,
    });
    setEditLog(null);
  };

  const DevIcon = ({ actual, estimated }) => {
    if (!estimated) return <Minus className="w-3.5 h-3.5 text-slate-400" />;
    const diff = actual - estimated;
    if (Math.abs(diff) < 300) return <Minus className="w-3.5 h-3.5 text-slate-400" />;
    if (diff > 0) return <TrendingUp className="w-3.5 h-3.5 text-amber-500" title="超时" />;
    return <TrendingDown className="w-3.5 h-3.5 text-emerald-500" title="提前" />;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">每日回顾</h1>
        <p className="text-sm text-slate-500 mt-0.5">对比计划与实际，找到改进空间</p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-3">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <div className="font-semibold text-slate-800">
            {format(new Date(selectedDate), "yyyy年M月d日", { locale: zhCN })}
          </div>
          <div className="text-xs text-slate-400">
            {format(new Date(selectedDate), "EEEE", { locale: zhCN })}
          </div>
        </div>
        <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Today's Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <div className="text-2xl font-bold text-indigo-600">{formatDuration(totalActual)}</div>
            <div className="text-xs text-slate-500 mt-0.5">总专注时长</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <div className="text-2xl font-bold text-slate-800">{dayLogs.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">时间记录数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{moduleComparison.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">涉及模块数</div>
          </CardContent>
        </Card>
      </div>

      {dayLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div className="text-sm">本日无记录</div>
            <div className="text-xs mt-1">切换日期或前往时间日志添加记录</div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Comparison Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  计划 vs 实际耗时（小时）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v, n) => [`${v}h`, n]}
                      labelFormatter={(l, payload) => payload?.[0]?.payload?.fullName || l}
                    />
                    <Bar dataKey="计划" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="实际" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Module Comparison Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">模块耗时对比</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {moduleComparison.map(m => {
                  const deviation = m.estimated > 0 ? m.actual - m.estimated : 0;
                  const devPct = m.estimated > 0 ? Math.round((deviation / m.estimated) * 100) : 0;
                  const progress = m.estimated > 0 ? Math.min(100, Math.round((m.actual / m.estimated) * 100)) : 100;
                  return (
                    <div key={m.moduleId} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-800">{m.moduleName}</span>
                        <div className="flex items-center gap-1.5">
                          <DevIcon actual={m.actual} estimated={m.estimated} />
                          {deviation !== 0 && (
                            <span className={cn("text-xs font-medium", deviation > 0 ? "text-amber-600" : "text-emerald-600")}>
                              {deviation > 0 ? "+" : ""}{formatDuration(Math.abs(deviation))}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <div className="text-xs text-slate-400 flex-shrink-0">
                          {formatDuration(m.actual)}
                          {m.estimated > 0 && <span className="text-slate-300"> / {formatDuration(m.estimated)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Log Records */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">时间记录明细</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dayLogs.map(log => (
                  <div key={log.id} className="p-3 bg-white border border-slate-100 rounded-lg group hover:border-indigo-200 transition-all">
                    {editLog?.id === log.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={editForm.duration || ""}
                            onChange={e => setEditForm(p => ({ ...p, duration: e.target.value }))}
                            placeholder="秒数"
                            className="w-28 h-8 text-xs"
                          />
                          <span className="text-xs text-slate-400 self-center">秒</span>
                        </div>
                        <Textarea
                          value={editForm.notes || ""}
                          onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                          rows={2}
                          className="text-xs resize-none"
                          placeholder="备注"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleSaveEdit} className="p-1.5 text-emerald-600 bg-emerald-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditLog(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">{log.moduleName}</span>
                            <Badge variant="outline" className="text-xs h-5">{formatDuration(log.duration)}</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                            <Clock className="w-3 h-3" />
                            {formatTime(log.startTime)} – {formatTime(log.endTime)}
                          </div>
                          {log.notes && <div className="text-xs text-slate-500 mt-1 bg-slate-50 px-2 py-1 rounded">{log.notes}</div>}
                          {(log.tags || []).length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {log.tags.map(t => <Badge key={t} variant="outline" className="text-xs h-4 px-1">{t}</Badge>)}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditLog(log); setEditForm({ duration: log.duration, notes: log.notes || "" }); }}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
