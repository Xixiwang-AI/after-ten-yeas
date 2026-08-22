import { lazy } from "react";
import {
  LayoutDashboard, Target, ListTodo, Clock, CalendarCheck, BarChart2, Settings,
} from "lucide-react";
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const VisionCenter = lazy(() => import("./pages/VisionCenter.jsx"));
const PlanManagement = lazy(() => import("./pages/PlanManagement.jsx"));
const TimeLog = lazy(() => import("./pages/TimeLog.jsx"));
const DailyReview = lazy(() => import("./pages/DailyReview.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));

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
