import {
  getOverviewStats,
  getEmailsSentOverTime,
  getTopIndustries,
  getTopCities,
  getAverageWebsiteScore,
  getPipelineStages,
  getScoreDistribution,
} from "@/lib/services/stats";
import { StatCard } from "@/components/shared/stat-card";
import { ChartCard } from "@/components/analytics/chart-card";
import { EmailsOverTimeChart } from "@/components/analytics/emails-over-time-chart";
import { HorizontalBarChart } from "@/components/analytics/horizontal-bar-chart";
import { PipelineChart } from "@/components/analytics/pipeline-chart";
import { ScoreDistributionChart } from "@/components/analytics/score-distribution-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { BarChart3, Reply, TrendingUp, CalendarCheck, Gauge } from "lucide-react";

export default async function AnalyticsPage() {
  const [stats, emailsOverTime, topIndustries, topCities, avgScore, pipeline, scoreDistribution] = await Promise.all([
    getOverviewStats(),
    getEmailsSentOverTime(30),
    getTopIndustries(),
    getTopCities(),
    getAverageWebsiteScore(),
    getPipelineStages(),
    getScoreDistribution(),
  ]);

  if (stats.leadsFound === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold tracking-tight">Analytics</h2>
        <EmptyState icon={BarChart3} title="Nothing to analyze yet" description="Once you've found leads and sent outreach, your pipeline analytics will show up here." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Pipeline performance across every lead you&apos;ve worked.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Reply Rate" value={`${stats.replyRate}%`} icon={Reply} />
        <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} icon={TrendingUp} />
        <StatCard label="Meetings Booked" value={stats.meetingsBooked} icon={CalendarCheck} />
        <StatCard label="Avg. Website Score" value={avgScore} icon={Gauge} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Emails Sent (Last 30 Days)" className="lg:col-span-2">
          <EmailsOverTimeChart data={emailsOverTime} />
        </ChartCard>
        <ChartCard title="Pipeline Stages" className="lg:col-span-1">
          <PipelineChart data={pipeline} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Top Industries">
          <HorizontalBarChart data={topIndustries} />
        </ChartCard>
        <ChartCard title="Top Cities">
          <HorizontalBarChart data={topCities} />
        </ChartCard>
        <ChartCard title="Website Score Distribution">
          <ScoreDistributionChart data={scoreDistribution} />
        </ChartCard>
      </div>
    </div>
  );
}
