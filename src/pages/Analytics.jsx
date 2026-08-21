import { useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { format, subDays, subMonths, subYears, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  BarChart2, TrendingUp, Clock, Target, Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Area, AreaChart,
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const RANGE_OPTIONS = [
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "year", label: "本年" },
];

export default function Analytics() {
  const { plans, timeLogs, getPlanCompletionRate } = useApp();
  const [range, setRange] = useState("month");

  const now = new Date();
  const rangeStart = useMemo(() => {
    if (range === "week") return format(subDays(now, 7), "yyyy-MM-dd");
    if (range === "month") return format(subMonths(now, 1), "yyyy-MM-dd");
    return format(subYears(now, 1), "yyyy-MM-dd");
  }, [range]);

  const filteredLogs = useMemo(() => {
    return timeLogs.filter(l => l.date >= rangeStart);
  }, [timeLogs, rangeStart]);

  const totalHours = (filteredLogs.reduce((s, l) => s + (l.duration || 0), 0) / 3600).toFixed(1);
  const avgDaily = filteredLogs.length > 0
    ? ((+totalHours) / Math.max(1, range === "week" ? 7 : range === "month" ? 30 : 365)).toFixed(1)
    : 0;

  // Module distribution
  const modulePieData = useMemo(() => {
    const map = {};
    filteredLogs.forEach(l => {
      const key = l.moduleName || "其他";
      map[key] = (map[key] || 0) + (l.duration || 0) / 3600;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, value]) => ({ name, value: +value.toFixed(1) }));
  }, [filteredLogs]);

  // Daily trend
  const dailyTrendData = useMemo(() => {
    const days = range === "week" ? 7 : range === "month" ? 30 : 52;
    const unit = range === "year" ? "week" : "day";
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      let label, start, end;
      if (unit === "week") {
        const weekStart = subDays(now, i * 7 + 6);
        const weekEnd = subDays(now, i * 7);
        start = format(weekStart, "yyyy-MM-dd");
        end = format(weekEnd, "yyyy-MM-dd");
        label = format(weekStart, "M/d");
      } else {
        const d = subDays(now, i);
        start = end = format(d, "yyyy-MM-dd");
        label = format(d, range === "week" ? "EE" : "M/d", { locale: zhCN });
      }
      const logs = timeLogs.filter(l => l.date >= start && l.date <= end);
      const hours = +(logs.reduce((s, l) => s + (l.duration || 0), 0) / 3600).toFixed(1);
      result.push({ label, hours });
    }
    return result;
  }, [timeLogs, range]);

  // Plan completion trend (by plan)
  const planCompletionData = useMemo(() => {
    return plans.slice(0, 8).map(p => ({
      name: p.name.length > 8 ? p.name.slice(0, 8) + "…" : p.name,
      fullName: p.name,
      rate: getPlanCompletionRate(p.id),
      status: p.status,
    }));
  }, [plans, getPlanCompletionRate]);

  // Efficiency metrics
  const completedPlans = plans.filter(p => p.status === "completed").length;
  const avgCompletionRate = plans.length > 0
    ? Math.round(plans.reduce((s, p) => s + getPlanCompletionRate(p.id), 0) / plans.length) : 0;

  // Time accuracy: for modules with both estimated and actual
  const modules = plans.flatMap(p => p.modules);
  const modulesWithBoth = modules.filter(m => m.estimatedHours > 0 && m.actualHours > 0);
  const avgAccuracy = modulesWithBoth.length > 0
    ? Math.round(modulesWithBoth.reduce((s, m) => {
        const acc = Math.max(0, 100 - Math.abs(m.actualHours - m.estimatedHours) / m.estimatedHours * 100);
        return s + acc;
      }, 0) / modulesWithBoth.length) : 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">数据分析</h1>
          <p className="text-sm text-slate-500 mt-0.5">深度了解你的时间投入与成效</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                range === opt.key ? "bg-white shadow-sm text-indigo-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={<Clock className="w-5 h-5 text-indigo-500" />} label="总专注时长" value={`${totalHours}h`} sub="时间段内" color="indigo" />
        <MetricCard icon={<TrendingUp className="w-5 h-5 text-cyan-500" />} label="日均时长" value={`${avgDaily}h`} sub="每天平均" color="cyan" />
        <MetricCard icon={<Target className="w-5 h-5 text-emerald-500" />} label="平均完成率" value={`${avgCompletionRate}%`} sub="所有计划" color="emerald" />
        <MetricCard icon={<Award className="w-5 h-5 text-amber-500" />} label="时间预估准确度" value={`${avgAccuracy}%`} sub="计划 vs 实际" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              专注时长趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v}h`, "专注时长"]} />
                <Area type="monotone" dataKey="hours" stroke="#6366f1" fill="url(#hoursGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Module Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">时间分配（按模块）</CardTitle>
          </CardHeader>
          <CardContent>
            {modulePieData.length > 0 ? (
              <div className="flex gap-3 items-center">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={modulePieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {modulePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${v}h`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {modulePieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs flex-1 truncate text-slate-600">{d.name}</span>
                      <span className="text-xs font-semibold">{d.value}h</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-slate-400">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Completion Rate Bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            各计划完成率
          </CardTitle>
        </CardHeader>
        <CardContent>
          {planCompletionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={planCompletionData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => [`${v}%`, "完成率"]}
                  labelFormatter={(l, payload) => payload?.[0]?.payload?.fullName || l}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {planCompletionData.map((d, i) => (
                    <Cell key={i} fill={d.status === "completed" ? "#10b981" : d.status === "in_progress" ? "#6366f1" : "#cbd5e1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400">暂无计划数据</div>
          )}
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-indigo-50 border-indigo-100">
          <CardContent className="pt-4 pb-4">
            <div className="text-lg font-bold text-indigo-700">{filteredLogs.length}</div>
            <div className="text-sm text-indigo-600">时间记录总数</div>
            <div className="text-xs text-indigo-400 mt-1">本{range === "week" ? "周" : range === "month" ? "月" : "年"}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="pt-4 pb-4">
            <div className="text-lg font-bold text-emerald-700">{completedPlans}</div>
            <div className="text-sm text-emerald-600">已完成计划</div>
            <div className="text-xs text-emerald-400 mt-1">共 {plans.length} 个计划</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="pt-4 pb-4">
            <div className="text-lg font-bold text-amber-700">{modules.filter(m => m.status === "completed").length}</div>
            <div className="text-sm text-amber-600">已完成模块</div>
            <div className="text-xs text-amber-400 mt-1">共 {modules.length} 个模块</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, color }) {
  const bgMap = { indigo: "bg-indigo-50", cyan: "bg-cyan-50", emerald: "bg-emerald-50", amber: "bg-amber-50" };
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className={`w-9 h-9 rounded-lg ${bgMap[color]} flex items-center justify-center mb-2`}>
          {icon}
        </div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-xs font-medium text-slate-600 mt-0.5">{label}</div>
        <div className="text-xs text-slate-400">{sub}</div>
      </CardContent>
    </Card>
  );
}
