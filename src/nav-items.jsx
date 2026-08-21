import {
  LayoutDashboard, Target, ListTodo, Clock, CalendarCheck, BarChart2, Settings,
} from "lucide-react";
import Dashboard from "./pages/Dashboard.jsx";
import VisionCenter from "./pages/VisionCenter.jsx";
import PlanManagement from "./pages/PlanManagement.jsx";
import TimeLog from "./pages/TimeLog.jsx";
import DailyReview from "./pages/DailyReview.jsx";
import Analytics from "./pages/Analytics.jsx";
import SettingsPage from "./pages/Settings.jsx";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  {
    title: "首页看板",
    to: "/",
    icon: <LayoutDashboard className="h-4 w-4" />,
    page: <Dashboard />,
  },
  {
    title: "十年后",
    to: "/vision",
    icon: <Target className="h-4 w-4" />,
    page: <VisionCenter />,
  },
  {
    title: "计划管理",
    to: "/plans",
    icon: <ListTodo className="h-4 w-4" />,
    page: <PlanManagement />,
  },
  {
    title: "时间日志",
    to: "/timelog",
    icon: <Clock className="h-4 w-4" />,
    page: <TimeLog />,
  },
  {
    title: "每日回顾",
    to: "/review",
    icon: <CalendarCheck className="h-4 w-4" />,
    page: <DailyReview />,
  },
  {
    title: "数据分析",
    to: "/analytics",
    icon: <BarChart2 className="h-4 w-4" />,
    page: <Analytics />,
  },
  {
    title: "设置中心",
    to: "/settings",
    icon: <Settings className="h-4 w-4" />,
    page: <SettingsPage />,
  },
];
