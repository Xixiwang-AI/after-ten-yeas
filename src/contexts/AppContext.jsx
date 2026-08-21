import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const AppContext = createContext(null);

// 登录页关闭后仍沿用原登录账号 ID；没有原账号时使用稳定的本地 ID
function getPersistentUserId() {
  try {
    const authUser = JSON.parse(localStorage.getItem("auth_user") || "null");
    if (authUser?.id) return authUser.id;
  } catch {
    // 忽略损坏的旧登录缓存，继续使用本地 ID
  }
  let fallbackId = localStorage.getItem("local_fallback_user_id");
  if (!fallbackId) {
    fallbackId = String(Date.now());
    localStorage.setItem("local_fallback_user_id", fallbackId);
  }
  return fallbackId;
}

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

// ===== Supabase 数据读写 =====
async function loadUserData(userId, key) {
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

async function saveUserData(userId, key, value) {
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
      // fallback: delete + insert
      await supabase.from("user_data").delete().eq("user_id", userId).eq("data_key", key);
      const { error: insertError } = await supabase.from("user_data").insert({
        user_id: userId, data_key: key, data_value: json,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      if (insertError) {
        console.error(`[saveUserData] fallback insert ${key} error:`, insertError.message);
      }
    }
  } catch (e) {
    console.error(`[saveUserData] ${key} exception:`, e);
  }
}

// ===== AppProvider =====
export function AppProvider({ children }) {
  const [userId] = useState(getPersistentUserId);

  const [visions, setVisions] = useState(defaultVisions);
  const [plans, setPlans] = useState(defaultPlans);
  const [timeLogs, setTimeLogs] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [activeTimer, setActiveTimer] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dailyPlans, setDailyPlans] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});

  // 防抖保存定时器
  const saveTimers = useRef({});
  // 用 ref 保存 userId，避免 scheduleSave 的 useCallback 依赖变化触发多余 effect
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ===== 从 Supabase 加载数据 =====
  useEffect(() => {
    if (!userId) {
      setDataLoaded(false);
      return;
    }
    setDataLoaded(false);

    (async () => {
      const [v, p, t, s, dp, rn] = await Promise.all([
        loadUserData(userId, "visions"),
        loadUserData(userId, "plans"),
        loadUserData(userId, "timeLogs"),
        loadUserData(userId, "settings"),
        loadUserData(userId, "dailyPlans"),
        loadUserData(userId, "reviewNotes"),
      ]);

      // undefined = 加载失败（网络错误），保持当前 state 不动，不覆盖
      // null = 数据库中无记录（新用户），写入默认值
      // 有值 = 正常加载，使用数据库值

      let isNewUser = false;

      if (v === null) {
        // 新用户，写入默认愿景
        setVisions(defaultVisions);
        saveUserData(userId, "visions", defaultVisions);
        isNewUser = true;
      } else if (v !== undefined) {
        setVisions(v);
      }
      // v === undefined（加载失败）：不 setVisions，保持当前值

      if (p === null) {
        setPlans(defaultPlans);
        if (isNewUser) saveUserData(userId, "plans", defaultPlans);
      } else if (p !== undefined) {
        setPlans(p);
      }

      if (t === null) {
        setTimeLogs([]);
      } else if (t !== undefined) {
        setTimeLogs(t);
      }

      if (s === null) {
        setSettings(defaultSettings);
      } else if (s !== undefined) {
        setSettings(s);
      }

      if (dp === null) {
        setDailyPlans({});
      } else if (dp !== undefined) {
        setDailyPlans(dp);
      }

      if (rn === null) {
        setReviewNotes({});
      } else if (rn !== undefined) {
        setReviewNotes(rn);
      }

      setDataLoaded(true);
    })();
  }, [userId]);

  // ===== 防抖同步到 Supabase（500ms 延迟合并写入）=====
  // 使用 userIdRef 避免 userId 变化时重建函数，进而触发所有 save effect
  const scheduleSave = useCallback((key, value) => {
    if (!userIdRef.current) return;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      if (userIdRef.current) {
        saveUserData(userIdRef.current, key, value);
      }
    }, 500);
  }, []); // 无依赖，函数永远不重建

  useEffect(() => { if (dataLoaded) scheduleSave("visions", visions); }, [visions, dataLoaded]);
  useEffect(() => { if (dataLoaded) scheduleSave("plans", plans); }, [plans, dataLoaded]);
  useEffect(() => { if (dataLoaded) scheduleSave("timeLogs", timeLogs); }, [timeLogs, dataLoaded]);
  useEffect(() => { if (dataLoaded) scheduleSave("settings", settings); }, [settings, dataLoaded]);
  useEffect(() => { if (dataLoaded) scheduleSave("dailyPlans", dailyPlans); }, [dailyPlans, dataLoaded]);
  useEffect(() => { if (dataLoaded) scheduleSave("reviewNotes", reviewNotes); }, [reviewNotes, dataLoaded]);

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
    dataLoaded,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
