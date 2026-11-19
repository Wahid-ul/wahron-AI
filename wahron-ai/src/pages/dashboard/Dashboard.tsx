
import {
  Card,
  CardContent,
  Typography,
  Button,
} from '@mui/material'

import {
  Eye,
  Heart,
  Users,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'

const metrics = [
  {
    title: 'Total Reach',
    value: '12,450',
    change: '+12.5%',
    icon: Eye,
  },
  {
    title: 'Engagement',
    value: '8.4%',
    change: '+2.3%',
    icon: Heart,
  },
  {
    title: 'Profile Visits',
    value: '1,280',
    change: '+8.2%',
    icon: Users,
  },
  {
    title: 'Content Published',
    value: '24',
    change: '+4 this month',
    icon: TrendingUp,
  },
]

export default function Dashboard() {
  return (
    <div className="space-y-8">

      {/* Heading */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Good morning 👋
          </Typography>

          <p className="mt-2 text-sm text-slate-500">
            Here's what's happening with your marketing today.
          </p>
        </div>

        <Button
          variant="contained"
          startIcon={<Sparkles size={18} />}
        >
          Create Campaign
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon

          return (
            <Card key={metric.title}>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {metric.title}
                  </p>

                  <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                    <Icon size={19} />
                  </div>
                </div>

                <h2 className="mt-4 text-2xl font-bold text-slate-900">
                  {metric.value}
                </h2>

                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <ArrowUpRight size={15} />
                  {metric.change}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* AI Recommendation */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
              <Sparkles size={22} />
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                Your AI Marketing Assistant
              </h3>

              <p className="text-sm text-slate-500">
                Your next recommended marketing action
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-indigo-50 p-5">
            <h4 className="font-semibold text-indigo-950">
              Promote your high-protein lunch bowls
            </h4>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create a short Reel showcasing the meal preparation
              process and highlighting its protein content.
              Compare it with a finished-product creative.
            </p>

            <Button
              variant="contained"
              sx={{ mt: 3 }}
            >
              Explore Recommendation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Empty campaign section */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-900">
            Recent Campaigns
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Your campaign activity will appear here once you start
            creating campaigns.
          </p>
        </CardContent>
      </Card>

    </div>
  )
}
