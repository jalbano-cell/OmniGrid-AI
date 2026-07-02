import {
  LayoutDashboard,
  Users,
  ScanSearch,
  Send,
  Mail,
  CalendarDays,
  BarChart3,
  Settings,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, shortcut: "G O" },
  { label: "Leads", href: "/leads", icon: Users, shortcut: "G L" },
  { label: "Website Audits", href: "/audits", icon: ScanSearch, shortcut: "G A" },
  { label: "Outreach Queue", href: "/outreach", icon: Send, shortcut: "G Q" },
  { label: "Email History", href: "/emails", icon: Mail, shortcut: "G E" },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, shortcut: "G C" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, shortcut: "G N" },
  { label: "Settings", href: "/settings", icon: Settings, shortcut: "G S" },
  { label: "Logs", href: "/logs", icon: ScrollText, shortcut: "G G" },
];
