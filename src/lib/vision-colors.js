export const VISION_COLORS = {
  indigo: { label: "靛蓝", gradient: "from-indigo-500 to-blue-400", ring: "ring-indigo-200", badge: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500", progress: "bg-indigo-500", dot: "bg-indigo-500", light: "bg-indigo-50", text: "text-indigo-600" },
  violet: { label: "紫罗兰", gradient: "from-violet-500 to-purple-400", ring: "ring-violet-200", badge: "bg-violet-100 text-violet-700", bar: "bg-violet-500", progress: "bg-violet-500", dot: "bg-violet-500", light: "bg-violet-50", text: "text-violet-600" },
  rose: { label: "玫瑰红", gradient: "from-rose-500 to-pink-400", ring: "ring-rose-200", badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500", progress: "bg-rose-500", dot: "bg-rose-500", light: "bg-rose-50", text: "text-rose-600" },
  amber: { label: "琥珀", gradient: "from-amber-500 to-orange-400", ring: "ring-amber-200", badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500", progress: "bg-amber-500", dot: "bg-amber-500", light: "bg-amber-50", text: "text-amber-600" },
  emerald: { label: "翠绿", gradient: "from-emerald-500 to-teal-400", ring: "ring-emerald-200", badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", progress: "bg-emerald-500", dot: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-600" },
  cyan: { label: "青色", gradient: "from-cyan-500 to-sky-400", ring: "ring-cyan-200", badge: "bg-cyan-100 text-cyan-700", bar: "bg-cyan-500", progress: "bg-cyan-500", dot: "bg-cyan-500", light: "bg-cyan-50", text: "text-cyan-600" },
};

export const getVisionColor = (colorKey) => VISION_COLORS[colorKey] || VISION_COLORS.indigo;
