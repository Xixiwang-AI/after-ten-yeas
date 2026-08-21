import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const AuthContext = createContext(null);

// 每次改动认证逻辑时递增此版本号，会自动清除旧缓存，让所有用户重新登录
const SESSION_VERSION = "v2";

function clearOldCache() {
  const storedVersion = localStorage.getItem("auth_session_version");
  if (storedVersion !== SESSION_VERSION) {
    localStorage.removeItem("auth_user");
    localStorage.setItem("auth_session_version", SESSION_VERSION);
  }
}

// 简单的密码哈希（前端侧 SHA-256，足够 MVP 使用）
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "vision_tracker_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// 登录页临时关闭期间使用的本地默认用户（保证 AppContext 数据读写有稳定的 userId）
const LOCAL_FALLBACK_USER_ID_KEY = "local_fallback_user_id";
function getOrCreateLocalFallbackUserId() {
  let id = localStorage.getItem(LOCAL_FALLBACK_USER_ID_KEY);
  if (!id) {
    // 生成一个稳定的本地数字 id（时间戳+随机数，足够本地唯一）
    id = String(Date.now());
    localStorage.setItem(LOCAL_FALLBACK_USER_ID_KEY, id);
  }
  return id;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // { id, username }
  const [loading, setLoading] = useState(true); // 初始化检查本地会话

  // 启动时从 localStorage 恢复会话
  // 策略：立即用本地缓存恢复登录态（不阻塞渲染），然后异步静默验证是否真实存在
  useEffect(() => {
    clearOldCache(); // 清除旧版本缓存
    const saved = localStorage.getItem("auth_user");
    if (!saved) {
      // 登录页临时关闭：没有登录记录时，使用本地默认用户，保证功能可用
      const fallbackId = getOrCreateLocalFallbackUserId();
      setCurrentUser({ id: fallbackId, username: "本地用户" });
      setLoading(false);
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(saved);
    } catch {
      localStorage.removeItem("auth_user");
      const fallbackId = getOrCreateLocalFallbackUserId();
      setCurrentUser({ id: fallbackId, username: "本地用户" });
      setLoading(false);
      return;
    }

    // 立即用本地缓存恢复登录态，先让页面渲染出来，不阻塞用户
    setCurrentUser({ id: parsed.id, username: parsed.username });
    setLoading(false);

    // 后台静默验证：确认用户在数据库中真实存在（加 3 秒超时兜底）
    const verifyPromise = supabase
      .from("users")
      .select("id, username")
      .eq("id", parsed.id)
      .maybeSingle();
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 3000));

    Promise.race([verifyPromise, timeoutPromise]).then(result => {
      if (result.timeout) return; // 网络慢时直接信任本地缓存，不踢出用户
      const { data, error } = result;
      // 只有在明确无网络错误、且数据库返回"用户不存在"时才踢出
      // 网络错误(error存在)时保持登录态，避免网络抖动导致白屏
      if (!error && data === null) {
        localStorage.removeItem("auth_user");
        // 登录页临时关闭：踢出后仍使用本地默认用户，不强制要求重新登录
        const fallbackId = getOrCreateLocalFallbackUserId();
        setCurrentUser({ id: fallbackId, username: "本地用户" });
      }
    });
  }, []);

  // 注册
  const register = useCallback(async (username, password) => {
    if (!username.trim() || !password.trim()) {
      return { success: false, error: "用户名和密码不能为空" };
    }
    if (username.length < 2) {
      return { success: false, error: "用户名至少2个字符" };
    }
    if (password.length < 6) {
      return { success: false, error: "密码至少6位" };
    }

    // 检查用户名是否已存在
    const { data: existing, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("username", username.trim())
      .maybeSingle();

    if (checkError) {
      return { success: false, error: "网络异常，请重试" };
    }
    if (existing) {
      return { success: false, error: "用户名已被注册" };
    }

    const passwordHash = await hashPassword(password);

    const { data, error } = await supabase
      .from("users")
      .insert({ username: username.trim(), password_hash: passwordHash })
      .select("id, username")
      .single();

    if (error) {
      return { success: false, error: "注册失败，请重试" };
    }

    const user = { id: data.id, username: data.username };
    setCurrentUser(user);
    localStorage.setItem("auth_user", JSON.stringify(user));
    return { success: true };
  }, []);

  // 登录
  const login = useCallback(async (username, password) => {
    if (!username.trim() || !password.trim()) {
      return { success: false, error: "请输入用户名和密码" };
    }

    const passwordHash = await hashPassword(password);

    const { data, error } = await supabase
      .from("users")
      .select("id, username")
      .eq("username", username.trim())
      .eq("password_hash", passwordHash)
      .maybeSingle();

    if (error) {
      return { success: false, error: "网络异常，请重试" };
    }
    if (!data) {
      return { success: false, error: "用户名或密码错误" };
    }

    const user = { id: data.id, username: data.username };
    setCurrentUser(user);
    localStorage.setItem("auth_user", JSON.stringify(user));
    return { success: true };
  }, []);

  // 登出
  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem("auth_user");
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
