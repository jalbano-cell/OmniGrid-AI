import Link from "next/link";
import { Users, ScanSearch, Mail, Send, Reply, CalendarCheck, TrendingUp, ArrowRight } from "lucide-react";
import { getOverviewStats } from "@/lib/services/stats";
import { prisma } from "@/lib/db/prisma";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default async function OverviewPage() {
  const stats = await getOverviewStats();

  const [recentLeads, recentLogs] = await Promise.all([
    prisma.business.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.logEntry.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const hasData = stats.leadsFound > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your sales outreach pipeline at a glance.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/leads">Find leads</Link>
        </Button>
      </div>

      {!hasData ? (
        <EmptyState
          icon={Users}
          title="No leads yet"
          description="Start by searching for businesses in an industry and city — OmniGrid AI will discover leads, audit their websites, and help you draft outreach."
          action={
            <Button asChild>
              <Link href="/leads">
                Find your first leads <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            <StatCard label="Leads Found" value={stats.leadsFound} icon={Users} />
            <StatCard label="Audits Completed" value={stats.auditsCompleted} icon={ScanSearch} />
            <StatCard label="Emails Drafted" value={stats.emailsDrafted} icon={Mail} />
            <StatCard label="Emails Sent" value={stats.emailsSent} icon={Send} />
            <StatCard label="Reply Rate" value={`${stats.replyRate}%`} icon={Reply} hint="of emails sent" />
            <StatCard label="Meetings Booked" value={stats.meetingsBooked} icon={CalendarCheck} />
            <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} icon={TrendingUp} hint="closed-won / sent" />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3 border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Recent Leads</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/leads">
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="divide-y divide-border/60">
                {recentLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/crm/${lead.id}`}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.industry} · {lead.city}
                      </p>
                    </div>
                    <StatusBadge status={lead.status} className="shrink-0 ml-3" />
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border/60">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="text-xs">
                    <p className="text-foreground/90 leading-snug">{log.message}</p>
                    <p className="text-muted-foreground/70 mt-0.5">
                      {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                ))}
                {recentLogs.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
