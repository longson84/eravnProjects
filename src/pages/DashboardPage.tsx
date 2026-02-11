// ==========================================
// Dashboard Page - Executive Dashboard
// ==========================================

import { useState, useEffect } from 'react';
import {
    FolderSync,
    FileCheck2,
    Clock,
    AlertTriangle,
    TrendingUp,
    Activity,
    CheckCircle2,
    XCircle,
    Timer,
    BarChart3,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAppContext } from '@/context/AppContext';
import {
    mockDashboardStats,
    mockSyncChartData,
    mockStorageChartData,
    mockActivityEvents,
    mockSyncSessions,
} from '@/data/mockData';
import type { DashboardStats, SyncChartData, StorageChartData, ActivityEvent, SyncSession } from '@/types/types';

export function DashboardPage() {
    const { state } = useAppContext();
    const [stats, setStats] = useState<DashboardStats>(mockDashboardStats);
    const [chartData, setChartData] = useState<SyncChartData[]>(mockSyncChartData);
    const [storageData, setStorageData] = useState<StorageChartData[]>(mockStorageChartData);
    const [activities, setActivities] = useState<ActivityEvent[]>(mockActivityEvents);
    const [recentSessions, setRecentSessions] = useState<SyncSession[]>(mockSyncSessions.slice(0, 5));

    const statCards = [
        {
            title: 'Tổng dự án',
            value: stats.totalProjects,
            subtitle: `${stats.activeProjects} đang hoạt động`,
            icon: FolderSync,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
        },
        {
            title: 'Files hôm nay',
            value: stats.filesSyncedToday,
            subtitle: `${stats.filesSyncedThisWeek} trong tuần`,
            icon: FileCheck2,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
        },
        {
            title: 'Tỉ lệ thành công',
            value: `${stats.successRate}%`,
            subtitle: `${stats.errorCount} lỗi gần đây`,
            icon: TrendingUp,
            color: 'text-violet-500',
            bgColor: 'bg-violet-500/10',
        },
        {
            title: 'Thời gian TB',
            value: `${stats.avgDurationSeconds}s`,
            subtitle: `${stats.totalSyncSessions} phiên tổng`,
            icon: Clock,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10',
        },
    ];

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'interrupted': return <Timer className="w-4 h-4 text-amber-500" />;
            default: return <Activity className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'sync_complete': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'sync_error': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'project_created': return <FolderSync className="w-4 h-4 text-blue-500" />;
            case 'project_updated': return <Activity className="w-4 h-4 text-violet-500" />;
            case 'settings_changed': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            default: return <Activity className="w-4 h-4" />;
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays > 0) return `${diffDays} ngày trước`;
        if (diffHours > 0) return `${diffHours} giờ trước`;
        const diffMin = Math.floor(diffMs / (1000 * 60));
        return `${diffMin} phút trước`;
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                    Tổng quan hoạt động đồng bộ và hiệu suất hệ thống
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((card) => (
                    <Card key={card.title} className="relative overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {card.title}
                            </CardTitle>
                            <div className={`p-2 rounded-lg ${card.bgColor}`}>
                                <card.icon className={`w-4 h-4 ${card.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{card.value}</div>
                            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                        </CardContent>
                        {/* Decorative gradient */}
                        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${card.bgColor}`} />
                    </Card>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-7">
                {/* Sync Performance Chart */}
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            Hiệu suất đồng bộ
                        </CardTitle>
                        <CardDescription>Số lượng file và thời gian xử lý 7 ngày gần đây</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorFiles" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={12}
                                    />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--popover))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                            color: 'hsl(var(--popover-foreground))',
                                        }}
                                    />
                                    <Legend />
                                    <Area
                                        type="monotone"
                                        dataKey="filesCount"
                                        stroke="hsl(var(--chart-1))"
                                        fillOpacity={1}
                                        fill="url(#colorFiles)"
                                        name="Files"
                                        strokeWidth={2}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="duration"
                                        stroke="hsl(var(--chart-2))"
                                        fillOpacity={1}
                                        fill="url(#colorDuration)"
                                        name="Thời gian (s)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Storage Chart */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            Dung lượng theo dự án
                        </CardTitle>
                        <CardDescription>Số file đã đồng bộ mỗi dự án (MB)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={storageData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis
                                        type="category"
                                        dataKey="projectName"
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={11}
                                        width={90}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--popover))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                            color: 'hsl(var(--popover-foreground))',
                                        }}
                                    />
                                    <Bar
                                        dataKey="totalSize"
                                        fill="hsl(var(--chart-4))"
                                        radius={[0, 4, 4, 0]}
                                        name="Dung lượng (MB)"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid gap-6 lg:grid-cols-5">
                {/* Recent Sessions */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ScrollText className="w-5 h-5 text-primary" />
                            Phiên đồng bộ gần đây
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentSessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(session.status)}
                                        <div>
                                            <p className="text-sm font-medium">{session.projectName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {session.filesCount} files • {session.executionDurationSeconds}s
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={
                                                session.status === 'success' ? 'success' :
                                                    session.status === 'error' ? 'destructive' : 'warning'
                                            }
                                        >
                                            {session.status === 'success' ? 'Thành công' :
                                                session.status === 'error' ? 'Lỗi' : 'Ngắt'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {formatTime(session.timestamp)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            Hoạt động gần đây
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {activities.map((event) => (
                                <div key={event.id} className="flex gap-3">
                                    <div className="mt-0.5">{getActivityIcon(event.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm">{event.message}</p>
                                        {event.projectName && (
                                            <p className="text-xs text-muted-foreground truncate">{event.projectName}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {formatTime(event.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Helper import for the icon used in JSX
import { ScrollText } from 'lucide-react';
