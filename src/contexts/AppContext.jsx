import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

const AppContext = createContext(null);

// 初始示例数据（仅新用户首次注册后写入一次）
const defaultVisions = [
  { id: "v1", title: "我的一年愿景", content: "掌握一门新技能，完成个人项目上线", color: "indigo", milestones: [], createdAt: new Date().toISOString() },
];

const defaultPlans = [
  {
    id: "p1", name: "学习 React 高级特性", visionId: "v1", status: "in_progress",
    startDate: new Date().toISOString(), endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    estimatedHours: 40, tags: ["技术", "前端"], notes: "", createdAt: new Date().toISOString(),
    modules: [
      { id: "m1", planId: "p1", name: "Hooks 深入", estimatedHours: 8, actualHours: 3, priority: "high", status: "in_progress", order: 0 },
      { id: "m2", planId: "p1", name: "状态管理", estimatedHours: 10, actualHours: 0, priority: "high", status: "pending", order: 1 },
      { id: "m3", planId: "p1", name: "性能优化", estimatedHours: 12, actualHours: 0, priority: "medium", status: "pending", order: 2 },
    ],
  },
];

const defaultSettings = {
  theme: "light",
  tags: ["技术", "学习", "项目", "健康", "生活"],
  notifications: { taskDueReminder: true, overtimeReminder: false },
};

function scopedStorageKey(userId, key) {
  return `vision_tracker:${userId}:${key}`;
}

function readLocalData(userId, key, fallbackValue) {
  try {
    const raw = localStorage.getItem(scopedStorageKey(userId, key));
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeLocalData(userId, key, value) {
  try {
    localStorage.setItem(scopedStorageKey(userId, key), JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[localStorage] ${key} error:`, error);
    return false;
  }
}

// 云同步只对 Supabase 已认证用户启用。默认使用本机持久化，避免匿名 user_id 造成数据越权。
async function loadUserData(supabase, userId, key) {
  try {
    const { data, error } = await supabase
      .from("user_data")
      .select("data_value")
      .eq("user_id", userId)
      .eq("data_key", key)
      .maybeSingle();
    if (error) {
      console.error(`[loadUserData] ${key} error:`, error.message);
      return undefined; // undefined 表示"加载失败"，区别于 null（"数据库中无此记录"）
    }
    if (!data) return null; // null 表示"首次使用，数据库中无记录"
    try { return JSON.parse(data.data_value); } catch { return null; }
  } catch (e) {
    console.error(`[loadUserData] ${key} exception:`, e);
    return undefined;
  }
}

async function saveUserData(supabase, userId, key, value) {
  try {
    const json = JSON.stringify(value);
    const { error } = await supabase
      .from("user_data")
      .upsert(
        { user_id: userId, data_key: key, data_value: json, updated_at: new Date().toISOString() },
        { onConflict: "user_id,data_key" }
      );
    if (error) {
      console.error(`[saveUserData] upsert ${key} error:`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[saveUserData] ${key} exception:`, e);
    return false;
  }
}

// ===== AppProvider =====
export function AppProvider({ children }) {
  const { user } = useAuth();
  const userId = user.id;
  const [visions, setVisions] = useState(() => readLocalData(userId, "visions", defaultVisions));
  const [plans, setPlans] = useState(() => readLocalData(userId, "plans", defaultPlans));
  const [timeLogs, setTimeLogs] = useState(() => readLocalData(userId, "timeLogs", []));
  const [settings, setSettings] = useState(() => readLocalData(userId, "settings", defaultSettings));
  const [activeTimer, setActiveTimer] = useState(() => readLocalData(userId, "activeTimer", null));
  const [dailyPlans, setDailyPlans] = useState(() => readLocalData(userId, "dailyPlans", {}));
  const [reviewNotes, setReviewNotes] = useState(() => readLocalData(userId, "reviewNotes", {}));
  const [dataLoaded] = useState(true);
  const [syncStatus, setSyncStatus] = useState("local");

  // 防抖保存定时器
  const saveTimers = useRef({});
  const cloudRef = useRef(null);
  const initialValuesRef = useRef({ visions, plans, timeLogs, settings, dailyPlans, reviewNotes });

  // 主题在首次渲染后立即恢复，而不是等用户再次切换开关。
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  // 登录后从属于当前用户的记录恢复数据；RLS 会在数据库侧再次校验 user_id。
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setSyncStatus("connecting");
      const { supabase } = await import("@/integrations/supabase/client");

      const [v, p, t, s, dp, rn] = await Promise.all([
        loadUserData(supabase, userId, "visions"),
        loadUserData(supabase, userId, "plans"),
        loadUserData(supabase, userId, "timeLogs"),
        loadUserData(supabase, userId, "settings"),
        loadUserData(supabase, userId, "dailyPlans"),
        loadUserData(supabase, userId, "reviewNotes"),
      ]);
      if (cancelled) return;
      if ([v, p, t, s, dp, rn].some(value => value === undefined)) {
        setSyncStatus("error");
        return;
      }

      cloudRef.current = { supabase, userId };
      if (v !== null) setVisions(v);
      if (p !== null) setPlans(p);
      if (t !== null) setTimeLogs(t);
      if (s !== null) setSettings(s);
      if (dp !== null) setDailyPlans(dp);
      if (rn !== null) setReviewNotes(rn);

      const remoteValues = { visions: v, plans: p, timeLogs: t, settings: s, dailyPlans: dp, reviewNotes: rn };
      const seedResults = await Promise.all(
        Object.entries(remoteValues)
          .filter(([, value]) => value === null)
          .map(([key]) => saveUserData(supabase, userId, key, initialValuesRef.current[key])),
      );
      if (cancelled) return;
      if (seedResults.some((ok) => !ok)) {
        setSyncStatus("error");
        return;
      }
      setSyncStatus("synced");
    })().catch((error) => {
      console.error("[cloudSync] init error:", error);
      if (!cancelled) setSyncStatus("error");
    });

    return () => { cancelled = true; };
  }, [userId]);

  // 所有变更先可靠写入本机；已认证且成功完成远端读取后才允许云端写入。
  const scheduleSave = useCallback((key, value) => {
    writeLocalData(userId, key, value);
    const cloud = cloudRef.current;
    if (!cloud) {
      setSyncStatus("local");
      return;
    }
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    setSyncStatus("saving");
    saveTimers.current[key] = setTimeout(async () => {
      const ok = await saveUserData(cloud.supabase, cloud.userId, key, value);
      setSyncStatus(ok ? "synced" : "error");
    }, 500);
  }, [userId]);

  useEffect(() => { scheduleSave("visions", visions); }, [visions, scheduleSave]);
  useEffect(() => { scheduleSave("plans", plans); }, [plans, scheduleSave]);
  useEffect(() => { scheduleSave("timeLogs", timeLogs); }, [timeLogs, scheduleSave]);
  useEffect(() => { scheduleSave("settings", settings); }, [settings, scheduleSave]);
  useEffect(() => { scheduleSave("dailyPlans", dailyPlans); }, [dailyPlans, scheduleSave]);
  useEffect(() => { scheduleSave("reviewNotes", reviewNotes); }, [reviewNotes, scheduleSave]);
  useEffect(() => { scheduleSave("activeTimer", activeTimer); }, [activeTimer, scheduleSave]);

  // ===== Vision CRUD =====
  const addVision = useCallback((visionData) => {
    const newVision = { id: `v${Date.now()}`, title: "新愿景", content: "", color: "indigo", milestones: [], createdAt: new Date().toISOString(), ...visionData };
    setVisions(prev => [...prev, newVision]);
    return newVision;
  }, []);

  const updateVision = useCallback((id, data) => {
    setVisions(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));
  }, []);

  const deleteVision = useCallback((id) => {
    setVisions(prev => prev.filter(v => v.id !== id));
  }, []);

  const addMilestone = useCallback((visionId, text) => {
    setVisions(prev => prev.map(v => v.id === visionId
      ? { ...v, milestones: [...(v.milestones || []), { id: Date.now().toString(), text, date: new Date().toISOString() }] }
      : v
    ));
  }, []);

  const removeMilestone = useCallback((visionId, milestoneId) => {
    setVisions(prev => prev.map(v => v.id === visionId
      ? { ...v, milestones: (v.milestones || []).filter(m => m.id !== milestoneId) }
      : v
    ));
  }, []);

  // ===== Plan CRUD =====
  const addPlan = useCallback((planData) => {
    const newPlan = { id: `p${Date.now()}`, modules: [], tags: [], notes: "", status: "pending", createdAt: new Date().toISOString(), ...planData };
    setPlans(prev => [newPlan, ...prev]);
    return newPlan;
  }, []);

  const updatePlan = useCallback((id, data) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  const deletePlan = useCallback((id) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  }, []);

  // ===== Module CRUD =====
  const addModule = useCallback((planId, moduleData) => {
    const newModule = { id: `m${Date.now()}`, planId, actualHours: 0, status: "pending", priority: "medium", order: 0, createdAt: new Date().toISOString(), ...moduleData };
    setPlans(prev => prev.map(p => p.id === planId
      ? { ...p, modules: [...p.modules, { ...newModule, order: p.modules.length }] }
      : p
    ));
    return newModule;
  }, []);

  const updateModule = useCallback((planId, moduleId, data) => {
    setPlans(prev => prev.map(p => p.id === planId
      ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, ...data } : m) }
      : p
    ));
  }, []);

  const deleteModule = useCallback((planId, moduleId) => {
    setPlans(prev => prev.map(p => p.id === planId
      ? { ...p, modules: p.modules.filter(m => m.id !== moduleId) }
      : p
    ));
  }, []);

  const reorderModules = useCallback((planId, newModules) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, modules: newModules } : p));
  }, []);

  // ===== Time Log CRUD =====
  const addTimeLog = useCallback((logData) => {
    const newLog = { id: `l${Date.now()}`, date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString(), ...logData };
    setTimeLogs(prev => [newLog, ...prev]);
    if (newLog.moduleId && newLog.duration) {
      const durationHours = newLog.duration / 3600;
      const plan = plans.find(p => p.modules.some(m => m.id === newLog.moduleId));
      if (plan) {
        updateModule(plan.id, newLog.moduleId, {
          actualHours: (plan.modules.find(m => m.id === newLog.moduleId)?.actualHours || 0) + durationHours,
        });
      }
    }
    return newLog;
  }, [plans, updateModule]);

  const updateTimeLog = useCallback((id, data) => {
    setTimeLogs(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
  }, []);

  const deleteTimeLog = useCallback((id) => {
    setTimeLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  // ===== Timer =====
  const startTimer = useCallback((moduleId, moduleName, planId) => {
    setActiveTimer({ moduleId, moduleName, planId, startTime: Date.now(), pausedTime: 0, paused: false });
  }, []);

  const pauseTimer = useCallback(() => {
    setActiveTimer(prev => prev ? { ...prev, paused: true, pausedAt: Date.now() } : null);
  }, []);

  const resumeTimer = useCallback(() => {
    setActiveTimer(prev => {
      if (!prev || !prev.paused) return prev;
      const pausedDuration = Date.now() - prev.pausedAt;
      return { ...prev, paused: false, pausedAt: null, startTime: prev.startTime + pausedDuration };
    });
  }, []);

  const stopTimer = useCallback((notes = "", tags = []) => {
    if (!activeTimer) return;
    const now = Date.now();
    const duration = Math.floor((now - activeTimer.startTime) / 1000);
    addTimeLog({
      moduleId: activeTimer.moduleId, moduleName: activeTimer.moduleName, planId: activeTimer.planId,
      startTime: new Date(activeTimer.startTime).toISOString(), endTime: new Date(now).toISOString(),
      duration, notes, tags, date: format(new Date(), "yyyy-MM-dd"),
    });
    setActiveTimer(null);
  }, [activeTimer, addTimeLog]);

  // ===== Computed =====
  const getAllModules = useCallback(() => plans.flatMap(p => p.modules.map(m => ({ ...m, planName: p.name, planStatus: p.status }))), [plans]);

  const getPlanCompletionRate = useCallback((planId) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan || plan.modules.length === 0) return 0;
    return Math.round((plan.modules.filter(m => m.status === "completed").length / plan.modules.length) * 100);
  }, [plans]);

  const getVisionCompletionRate = useCallback((visionId) => {
    const allModules = plans.filter(p => p.visionId === visionId).flatMap(p => p.modules);
    if (allModules.length === 0) return 0;
    return Math.round((allModules.filter(m => m.status === "completed").length / allModules.length) * 100);
  }, [plans]);

  const getTodayLogs = useCallback(() => timeLogs.filter(l => l.date === format(new Date(), "yyyy-MM-dd")), [timeLogs]);
  const getTodayTotalSeconds = useCallback(() => getTodayLogs().reduce((sum, l) => sum + (l.duration || 0), 0), [getTodayLogs]);
  const getLogsForDate = useCallback((dateStr) => timeLogs.filter(l => l.date === dateStr), [timeLogs]);

  // ===== Daily Plans CRUD =====
  // 返回某天需要展示的任务：创建日===date 的 + 其他日创建但 targetDate===date 的
  const getDailyPlansForDate = useCallback((date) => {
    const result = [];
    const seen = new Set();
    Object.entries(dailyPlans).forEach(([createdDate, items]) => {
      (items || []).forEach(item => {
        const target = item.targetDate || createdDate;
        if ((createdDate === date || target === date) && !seen.has(item.id)) {
          seen.add(item.id);
          result.push({ ...item, createdDate });
        }
      });
    });
    return result;
  }, [dailyPlans]);

  const addDailyPlanItem = useCallback((date, presetId) => {
    const id = presetId || `dp-${Date.now()}`;
    setDailyPlans(prev => ({
      ...prev,
      [date]: [...(prev[date] || []), {
        id, customName: "", moduleId: "", planId: "",
        moduleName: "", planName: "", visionId: "", done: false,
        createdDate: date, targetDate: date,
      }],
    }));
  }, []);

  // patch 操作始终在《创建日》的数组里进行
  const updateDailyPlanItem = useCallback((createdDate, id, patch) => {
    setDailyPlans(prev => {
      // 如果传入的 createdDate 不对（兼容老数据），搜全局找到真实创建日
      const realDate = (prev[createdDate] || []).some(x => x.id === id)
        ? createdDate
        : (Object.keys(prev).find(d => (prev[d] || []).some(x => x.id === id)) || createdDate);
      return {
        ...prev,
        [realDate]: (prev[realDate] || []).map(x => x.id === id ? { ...x, ...patch } : x),
      };
    });
  }, []);

  const toggleDailyPlanItem = useCallback((createdDate, id) => {
    setDailyPlans(prev => {
      const realDate = (prev[createdDate] || []).some(x => x.id === id)
        ? createdDate
        : (Object.keys(prev).find(d => (prev[d] || []).some(x => x.id === id)) || createdDate);
      return {
        ...prev,
        [realDate]: (prev[realDate] || []).map(x => x.id === id ? { ...x, done: !x.done } : x),
      };
    });
  }, []);

  const removeDailyPlanItem = useCallback((createdDate, id) => {
    setDailyPlans(prev => {
      const realDate = (prev[createdDate] || []).some(x => x.id === id)
        ? createdDate
        : (Object.keys(prev).find(d => (prev[d] || []).some(x => x.id === id)) || createdDate);
      return {
        ...prev,
        [realDate]: (prev[realDate] || []).filter(x => x.id !== id),
      };
    });
  }, []);

  // ===== Review Notes CRUD =====
  const updateReviewNote = useCallback((date, text) => {
    setReviewNotes(prev => ({ ...prev, [date]: text }));
  }, []);

  const getReviewNote = useCallback((date) => reviewNotes[date] || "", [reviewNotes]);

  const updateSettings = useCallback((data) => {
    setSettings(prev => ({ ...prev, ...data }));
  }, []);

  const value = {
    visions, addVision, updateVision, deleteVision, addMilestone, removeMilestone,
    plans, addPlan, updatePlan, deletePlan,
    addModule, updateModule, deleteModule, reorderModules,
    timeLogs, addTimeLog, updateTimeLog, deleteTimeLog,
    settings, updateSettings,
    activeTimer, startTimer, pauseTimer, resumeTimer, stopTimer,
    getAllModules, getPlanCompletionRate, getVisionCompletionRate,
    getTodayLogs, getTodayTotalSeconds, getLogsForDate,
    dailyPlans, getDailyPlansForDate, addDailyPlanItem, updateDailyPlanItem, toggleDailyPlanItem, removeDailyPlanItem,
    reviewNotes, updateReviewNote, getReviewNote,
    dataLoaded, syncStatus, storagePrefix: `vision_tracker:${userId}:`,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
