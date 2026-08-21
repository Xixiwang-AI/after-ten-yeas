import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Target, ListTodo, Clock,
  BarChart2, CalendarCheck, Settings, ChevronDown, ChevronRight,
  Menu, X, Zap, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { ActiveTimerBadge } from "./ActiveTimerBadge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const primaryNav = [
  { to: "/", label: "首页看板", icon: LayoutDashboard },
  { to: "/vision", label: "十年后", icon: Target },
  { to: "/plans", label: "计划管理", icon: ListTodo },
  { to: "/timelog", label: "时间日志", icon: Clock },
];

const moreNav = [
  { to: "/review", label: "每日回顾", icon: CalendarCheck },
  { to: "/analytics", label: "数据分析", icon: BarChart2 },
  { to: "/settings", label: "设置中心", icon: Settings },
];

export default function Layout({ children }) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { activeTimer } = useApp();
  const currentUser = { username: "本地用户" };

  const isActive = (to) => location.pathname === to;
  const isMoreActive = moreNav.some(n => isActive(n.to));

  // 取用户名首字作为头像字母
  const avatarLetter = currentUser?.username?.[0]?.toUpperCase() || "U";

  const NavItem = ({ to, label, icon: Icon, onClick }) => (
    <Link
      to={to}
      onClick={() => { setSidebarOpen(false); onClick?.(); }}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
        isActive(to)
          ? "bg-indigo-600 text-white shadow-md"
          : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-700"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  );

  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 w-full px-1 py-1 rounded-lg hover:bg-slate-100 transition-colors">
          <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {avatarLetter}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-xs font-medium text-slate-700 truncate">{currentUser?.username}</div>
            <div className="text-xs text-slate-400">已登录</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <div className="px-2 py-1.5">
          <div className="text-xs font-semibold text-slate-700">{currentUser?.username}</div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">愿景追踪</div>
            <div className="text-xs text-slate-400">时间管理系统</div>
          </div>
        </div>
      </div>

      {/* Primary Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {primaryNav.map(item => <NavItem key={item.to} {...item} />)}

        {/* More Dropdown */}
        <div>
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isMoreActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-700"
            )}
          >
            <span className="flex items-center gap-3">
              <ChevronRight className="w-4 h-4" />
              更多功能
            </span>
            {moreOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {moreOpen && (
            <div className="mt-1 pl-3 space-y-1 border-l-2 border-indigo-100 ml-3">
              {moreNav.map(item => <NavItem key={item.to} {...item} />)}
            </div>
          )}
        </div>
      </nav>

      {/* Active Timer */}
      {activeTimer && (
        <div className="px-3 pb-2">
          <ActiveTimerBadge />
        </div>
      )}

      {/* User / Bottom */}
      <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-700">
        <UserMenu />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-white dark:bg-slate-800 shadow-xl z-50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-md hover:bg-slate-100">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold">愿景追踪</span>
          </div>
          {/* Mobile user avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {avatarLetter}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <div className="px-2 py-1.5">
                <div className="text-xs font-semibold text-slate-700">{currentUser?.username}</div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
