import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subDays, parseISO, eachDayOfInterval, addDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Clock, Target, ListTodo, TrendingUp, Play, ChevronRight, CheckCircle2, Circle, Zap,
  Download, FileDown, Calendar, X, ChevronLeft,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { getVisionColor } from "./VisionCenter";
import { cn } from "@/lib/utils";

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

export default function Dashboard() {
  const {
    plans, visions, timeLogs, getTodayLogs, getTodayTotalSeconds,
    getPlanCompletionRate, getVisionCompletionRate, getAllModules, startTimer,
    getDailyPlansForDate, getLogsForDate,
  } = useApp();
  const navigate = useNavigate();

  // ── 日期筛选 ──
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;

  const shiftDate = (delta) => {
    const d = new Date(selectedDate + "T00:00:00");
    setSelectedDate(format(addDays(d, delta), "yyyy-MM-dd"));
  };

  // 选中日期的时间记录
  const dayLogs = useMemo(() => getLogsForDate(selectedDate), [selectedDate, timeLogs]);
  const daySeconds = dayLogs.reduce((s, l) => s + (l.duration || 0), 0);
  const dayHours = (daySeconds / 3600).toFixed(1);

  // 今日完成度 = 当日计划完成条数 / 当日计划总条数
  const dayDailyPlans = useMemo(() => getDailyPlansForDate(selectedDate), [selectedDate, getDailyPlansForDate]);
  const dayPlanTotal = dayDailyPlans.length;
  const dayPlanDone = dayDailyPlans.filter(p => p.done).length;
  const todayCompletionPct = dayPlanTotal > 0 ? Math.round((dayPlanDone / dayPlanTotal) * 100) : 0;

  // 兼容旧的 todayLogs / todaySeconds（用于其他地方）
  const todayLogs = getTodayLogs();
  const todaySeconds = getTodayTotalSeconds();

  // 时间分配饼图（选中日期）
  const pieData = useMemo(() => {
    const map = {};
    dayLogs.forEach(log => {
      const key = log.moduleName || "其他";
      map[key] = (map[key] || 0) + (log.duration || 0) / 3600;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: +value.toFixed(1) }));
  }, [dayLogs]);

  // 近7天时间分布柱状图
  const weekBarData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dLogs = timeLogs.filter(l => l.date === dateStr);
      const hours = (dLogs.reduce((s, l) => s + (l.duration || 0), 0) / 3600).toFixed(1);
      days.push({ day: format(d, "M/d", { locale: zhCN }), hours: +hours, isSelected: dateStr === selectedDate });
    }
    return days;
  }, [timeLogs, selectedDate]);

  // 下一个待执行任务
  const nextTask = useMemo(() => {
    const pendingModules = plans
      .filter(p => p.status === "in_progress")
      .flatMap(p => p.modules.map(m => ({ ...m, planName: p.name, planId: p.id })))
      .filter(m => m.status !== "completed")
      .sort((a, b) => {
        const pMap = { high: 0, medium: 1, low: 2 };
        return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
      });
    return pendingModules[0] || null;
  }, [plans]);

  // 本周已完成计划
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekCompletedModules = useMemo(() => {
    const weekLogModuleIds = new Set(
      timeLogs.filter(l => l.date >= weekStartStr).map(l => l.moduleId)
    );
    return plans.flatMap(p =>
      p.modules
        .filter(m => m.status === "completed" || weekLogModuleIds.has(m.id))
        .map(m => ({ ...m, planName: p.name }))
    ).slice(0, 6);
  }, [plans, timeLogs, weekStartStr]);

  const priorityColor = { high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-700", low: "bg-green-100 text-green-700" };
  const priorityLabel = { high: "高", medium: "中", low: "低" };

  // ── 导出功能 ──
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRange, setExportRange] = useState("7"); // "7" | "30" | "90" | "all" | "custom"
  const [exportStart, setExportStart] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [exportEnd, setExportEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportTypes, setExportTypes] = useState({ timeLogs: true, plans: true, visions: true });

  const toggleType = (k) => setExportTypes(prev => ({ ...prev, [k]: !prev[k] }));

  // 根据 range 计算日期
  const getDateRange = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (exportRange === "7")   return { start: format(subDays(new Date(), 6), "yyyy-MM-dd"), end: today };
    if (exportRange === "30")  return { start: format(subDays(new Date(), 29), "yyyy-MM-dd"), end: today };
    if (exportRange === "90")  return { start: format(subDays(new Date(), 89), "yyyy-MM-dd"), end: today };
    if (exportRange === "all") return { start: "2000-01-01", end: today };
    return { start: exportStart, end: exportEnd };
  };

  const doExport = () => {
    const { start, end } = getDateRange();
    const filteredLogs = timeLogs.filter(l => l.date >= start && l.date <= end);
    const planMap = Object.fromEntries(plans.map(p => [p.id, p]));
    const visionMap = Object.fromEntries(visions.map(v => [v.id, v]));

    if (exportFormat === "csv") {
      const sheets = [];

      if (exportTypes.timeLogs) {
        const headers = ["日期","模块名称","所属计划","所属愿景","开始时间","结束时间","时长(分钟)","备注"];
        const rows = filteredLogs.map(log => {
          const plan = planMap[log.planId];
          const vision = plan ? visionMap[plan.visionId] : null;
          const st = log.startTime ? format(parseISO(log.startTime), "HH:mm") : "";
          const et = log.endTime ? format(parseISO(log.endTime), "HH:mm") : "";
          return [log.date, log.moduleName||"", plan?.name||"", vision?.title||"", st, et, log.duration ? Math.round(log.duration/60) : 0, log.notes||""];
        });
        sheets.push({ name: "时间记录", headers, rows });
      }

      if (exportTypes.plans) {
        const headers = ["计划名称","所属愿景","状态","开始日期","截止日期","预计时长(h)","模块数","完成模块数","备注"];
        const statusLabel = { pending: "待开始", in_progress: "进行中", completed: "已完成" };
        const rows = plans.map(p => {
          const vision = visionMap[p.visionId];
          const completed = (p.modules||[]).filter(m=>m.status==="completed").length;
          return [p.name, vision?.title||"", statusLabel[p.status]||"", p.startDate?format(parseISO(p.startDate),"yyyy-MM-dd"):"", p.endDate?format(parseISO(p.endDate),"yyyy-MM-dd"):"", p.estimatedHours||0, (p.modules||[]).length, completed, p.notes||""];
        });
        sheets.push({ name: "计划管理", headers, rows });
      }

      if (exportTypes.visions) {
        const headers = ["愿景标题","内容","颜色","里程碑数","创建时间"];
        const rows = visions.map(v => [v.title, v.content||"", v.color||"", (v.milestones||[]).length, v.createdAt?format(parseISO(v.createdAt),"yyyy-MM-dd"):""]);
        sheets.push({ name: "愿景", headers, rows });
      }

      // 合并为一个 CSV（用空行分隔不同表）
      let csv = "";
      sheets.forEach(sheet => {
        csv += `\n=== ${sheet.name} ===\n`;
        csv += [sheet.headers, ...sheet.rows].map(row =>
          row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(",")
        ).join("\n");
        csv += "\n";
      });

      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `全站数据_${start}_${end}.csv`;
      a.click(); URL.revokeObjectURL(url);

    } else {
      // JSON
      const data = {};
      if (exportTypes.timeLogs) {
        data.timeLogs = filteredLogs.map(log => {
          const plan = planMap[log.planId];
          const vision = plan ? visionMap[plan.visionId] : null;
          return { ...log, planName: plan?.name||"", visionTitle: vision?.title||"" };
        });
      }
      if (exportTypes.plans) {
        data.plans = plans.map(p => ({ ...p, visionTitle: visionMap[p.visionId]?.title||"" }));
      }
      if (exportTypes.visions) {
        data.visions = visions;
      }
      data.exportedAt = new Date().toISOString();
      data.dateRange = { start, end };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `全站数据_${start}_${end}.json`;
      a.click(); URL.revokeObjectURL(url);
    }
    setExportOpen(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {isToday ? format(new Date(), "M月d日 EEEE", { locale: zhCN }) + " · 今日看板" : format(new Date(selectedDate + "T00:00:00"), "M月d日 EEEE", { locale: zhCN }) + " · 历史看板"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">专注当下，每一刻都值得记录</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 日期切换 */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1 py-1">
            <button onClick={() => shiftDate(-1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs text-slate-700 font-medium bg-transparent outline-none cursor-pointer w-[88px] text-center"
            />
            <button
              onClick={() => shiftDate(1)}
              disabled={selectedDate >= today}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isToday && (
              <button onClick={() => setSelectedDate(today)} className="ml-0.5 px-2 py-0.5 text-xs text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg transition-all">
                今天
              </button>
            )}
          </div>
          <Button variant="outline" className="gap-2 text-slate-600" onClick={() => setExportOpen(true)}>
            <Download className="w-4 h-4" />
            下载数据
          </Button>
          <Button onClick={() => navigate("/timelog")} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Play className="w-4 h-4" />
            开始计时
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<TrendingUp className="w-5 h-5 text-indigo-500" />} label="当日完成度" value={`${todayCompletionPct}%`} sub={dayPlanTotal > 0 ? `${dayPlanDone}/${dayPlanTotal} 项计划` : "暂无当日计划"} color="indigo" />
        <StatCard icon={<Clock className="w-5 h-5 text-cyan-500" />} label={isToday ? "今日专注" : "当日专注"} value={`${dayHours}h`} sub={`${dayLogs.length} 条记录`} color="cyan" />
        <StatCard icon={<ListTodo className="w-5 h-5 text-violet-500" />} label="进行中计划" value={plans.filter(p => p.status === "in_progress").length} sub={`共 ${plans.length} 个计划`} color="violet" />
        <StatCard icon={<Target className="w-5 h-5 text-emerald-500" />} label="愿景总进度" value={`${Math.round(visions.reduce((s, v) => s + getVisionCompletionRate(v.id), 0) / (visions.length || 1))}%`} sub="综合完成率" color="emerald" />
      </div>

      {/* Day Completion */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">{isToday ? "今日" : format(new Date(selectedDate + "T00:00:00"), "M月d日", { locale: zhCN })}完成进度</span>
            <span className="text-sm font-bold text-indigo-600">
              {dayPlanTotal > 0 ? `${dayPlanDone} / ${dayPlanTotal} 项` : "无计划"}
              {dayPlanTotal > 0 && <span className="ml-1.5 text-indigo-400">({todayCompletionPct}%)</span>}
            </span>
          </div>
          <Progress value={todayCompletionPct} className="h-3" />
          {dayPlanTotal === 0 && (
            <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
              <Circle className="w-3.5 h-3.5" /> 前往时间日志页面添加当日计划
            </div>
          )}
          {todayCompletionPct >= 80 && dayPlanTotal > 0 && (
            <div className="mt-2 flex items-center gap-2 text-emerald-600 text-sm">
              <Zap className="w-4 h-4" /> 太棒了！{isToday ? "今天" : "这天"}完成度很高，继续保持！
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Next Task */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-500" /> 下一项任务
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextTask ? (
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-slate-800 text-sm">{nextTask.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{nextTask.planName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityColor[nextTask.priority]}`}>
                    {priorityLabel[nextTask.priority]}优先级
                  </span>
                  <span className="text-xs text-slate-500">预计 {nextTask.estimatedHours}h</span>
                </div>
                <Button
                  size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                  onClick={() => startTimer(nextTask.id, nextTask.name, nextTask.planId)}
                >
                  <Play className="w-3 h-3" /> 立即开始
                </Button>
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                暂无待执行任务
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{isToday ? "今日" : format(new Date(selectedDate + "T00:00:00"), "M月d日", { locale: zhCN })}时间分配</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${v}h`} contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* 自定义图例：小字体，横向换行 */}
                <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 px-1">
                  {pieData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[10px] text-slate-500 truncate max-w-[64px]">{entry.name}</span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{entry.value}h</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-slate-400">{isToday ? "今日" : "当日"}暂无记录</div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">近7天专注时长</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weekBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}h`, "专注时长"]} />
                <Bar dataKey="hours" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vision Progress */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">愿景完成进度</CardTitle>
              <Link to="/vision" className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
                管理 <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {visions.map(v => {
              const pct = getVisionCompletionRate(v.id);
              const cfg = getVisionColor(v.color);
              return (
                <div key={v.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <span className={cn("w-2 h-2 rounded-full inline-block flex-shrink-0", cfg.dot)} />
                      {v.title}
                    </span>
                    <span className={cn("text-xs font-bold", cfg.text)}>{pct}%</span>
                  </div>
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("absolute inset-y-0 left-0 rounded-full transition-all", cfg.bar)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* This Week Done */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">本周已完成模块</CardTitle>
              <Link to="/plans" className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
                全部 <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {weekCompletedModules.length > 0 ? (
              <div className="space-y-2">
                {weekCompletedModules.map(m => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{m.name}</div>
                      <div className="text-xs text-slate-400 truncate">{m.planName}</div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{m.actualHours}h</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-slate-400">
                <Circle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                本周暂无完成记录
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Motivational Quote */}
      <Card className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 flex-shrink-0 opacity-80" />
            <div>
              <div className="text-sm font-medium opacity-90">每一步都算数</div>
              <div className="text-xs opacity-70 mt-0.5">你的坚持正在悄悄改变命运的轨迹</div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* 下载数据弹窗 */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Download className="w-4 h-4 text-indigo-500" /> 下载我的数据
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-0.5">将数据导出为表格文件，可用 Excel 直接打开</p>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* 选择时间段 */}
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">选择时间段</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["7",  "最近一周",  "过去 7 天的记录"],
                  ["30", "最近一个月","过去 30 天的记录"],
                  ["90", "最近三个月","过去 90 天的记录"],
                  ["all","全部记录",  "所有历史数据"],
                ].map(([v, l, hint]) => (
                  <button key={v} onClick={() => setExportRange(v)}
                    className={cn(
                      "text-left px-3 py-2.5 rounded-xl border transition-all",
                      exportRange === v
                        ? "bg-indigo-600 border-indigo-600"
                        : "border-slate-200 hover:border-indigo-200 hover:bg-indigo-50"
                    )}>
                    <div className={cn("text-sm font-semibold", exportRange === v ? "text-white" : "text-slate-700")}>{l}</div>
                    <div className={cn("text-xs mt-0.5", exportRange === v ? "text-indigo-200" : "text-slate-400")}>{hint}</div>
                  </button>
                ))}
              </div>
              {/* 自定义日期 */}
              <button onClick={() => setExportRange("custom")}
                className={cn(
                  "w-full mt-2 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-1.5",
                  exportRange === "custom"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                    : "border-dashed border-slate-200 text-slate-400 hover:border-indigo-200 hover:text-indigo-500"
                )}>
                <Calendar className="w-3.5 h-3.5" /> 自定义起止日期
              </button>
              {exportRange === "custom" && (
                <div className="flex items-center gap-2 mt-2">
                  <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  <span className="text-xs text-slate-400 flex-shrink-0">到</span>
                  <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                </div>
              )}
            </div>

            {/* 包含内容 */}
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">包含哪些内容</Label>
              <div className="space-y-2">
                {(() => {
                  const { start, end } = getDateRange();
                  const logCount = timeLogs.filter(l => l.date >= start && l.date <= end).length;
                  return [
                    { key: "timeLogs", label: "时间记录",  hint: `${logCount} 条，每天记录了多久、做了什么` },
                    { key: "plans",    label: "我的计划",  hint: `${plans.length} 个计划及其下的任务模块` },
                    { key: "visions",  label: "我的愿景",  hint: `${visions.length} 个愿景目标` },
                  ];
                })().map(({ key, label, hint }) => (
                  <div key={key} onClick={() => toggleType(key)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all",
                      exportTypes[key] ? "bg-indigo-50 border-indigo-200" : "border-slate-100 hover:bg-slate-50"
                    )}>
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                      exportTypes[key] ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                    )}>
                      {exportTypes[key] && <span className="text-white" style={{ fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium", exportTypes[key] ? "text-indigo-700" : "text-slate-700")}>{label}</div>
                      <div className="text-xs text-slate-400 truncate">{hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部提示 */}
            {Object.values(exportTypes).some(Boolean) && (() => {
              const { start, end } = getDateRange();
              const rangeLabel = exportRange === "all" ? "全部历史" : exportRange === "custom" ? `${start} 至 ${end}` :
                exportRange === "7" ? "最近一周" : exportRange === "30" ? "最近一个月" : "最近三个月";
              return (
                <div className="bg-indigo-50 rounded-xl px-3 py-2.5 text-xs text-indigo-600 flex items-start gap-2">
                  <FileDown className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>将下载一个表格文件（可用 Excel 打开），包含{rangeLabel}的数据</span>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExportOpen(false)}>取消</Button>
            <Button
              onClick={doExport}
              disabled={!Object.values(exportTypes).some(Boolean)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              <Download className="w-4 h-4" /> 下载表格
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  const bgMap = { indigo: "bg-indigo-50", cyan: "bg-cyan-50", violet: "bg-violet-50", emerald: "bg-emerald-50" };
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className={`w-9 h-9 rounded-lg ${bgMap[color]} flex items-center justify-center mb-2`}>
          {icon}
        </div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-xs font-medium text-slate-600 mt-0.5">{label}</div>
        <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}
