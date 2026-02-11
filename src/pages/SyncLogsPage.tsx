import { useState } from 'react';
import { ScrollText, Search, Filter, ChevronDown, ChevronRight, FileText, ExternalLink, CheckCircle2, XCircle, Timer, Clock, HardDrive, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { gasService } from '@/services/gasService';
import { mockSyncSessions } from '@/data/mockData';
import type { SyncSession, FileLog } from '@/types/types';

export function SyncLogsPage() {
    const [sessions] = useState<SyncSession[]>(mockSyncSessions);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [fileLogs, setFileLogs] = useState<Record<string, FileLog[]>>({});
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [search, setSearch] = useState('');

    const filteredSessions = sessions.filter((s) => {
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        const matchesSearch = s.projectName.toLowerCase().includes(search.toLowerCase()) || s.runId.toLowerCase().includes(search.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const handleExpand = async (sessionId: string) => {
        if (expandedSession === sessionId) { setExpandedSession(null); return; }
        setExpandedSession(sessionId);
        if (!fileLogs[sessionId]) {
            setLoading(true);
            try {
                const logs = await gasService.getFileLogs(sessionId);
                setFileLogs((prev) => ({ ...prev, [sessionId]: logs }));
            } catch (e) { console.error(e); } finally { setLoading(false); }
        }
    };

    const fmt = (d: string) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const fmtSize = (b?: number) => { if (!b) return '—'; if (b < 1024) return `${b} B`; if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`; return `${(b / 1048576).toFixed(1)} MB`; };

    const statusBadge = (s: string) => {
        if (s === 'success') return <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Thành công</Badge>;
        if (s === 'error') return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Lỗi</Badge>;
        return <Badge variant="warning"><Timer className="w-3 h-3 mr-1" />Ngắt</Badge>;
    };

    const totalFiles = filteredSessions.reduce((a, s) => a + s.filesCount, 0);
    const avgDur = filteredSessions.length ? Math.round(filteredSessions.reduce((a, s) => a + s.executionDurationSeconds, 0) / filteredSessions.length) : 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Sync Logs</h1>
                <p className="text-muted-foreground mt-1">Lịch sử các phiên đồng bộ và chi tiết file</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {[{ icon: ScrollText, color: 'blue', val: filteredSessions.length, label: 'Phiên tổng cộng' }, { icon: FileText, color: 'emerald', val: totalFiles, label: 'Files đã xử lý' }, { icon: Clock, color: 'amber', val: `${avgDur}s`, label: 'Thời gian TB / phiên' }].map((c, i) => (
                    <Card key={i}><CardContent className="pt-6"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg bg-${c.color}-500/10`}><c.icon className={`w-4 h-4 text-${c.color}-500`} /></div><div><p className="text-2xl font-bold">{c.val}</p><p className="text-xs text-muted-foreground">{c.label}</p></div></div></CardContent></Card>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Tìm theo tên dự án hoặc Run ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Lọc trạng thái" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="success">Thành công</SelectItem>
                        <SelectItem value="error">Lỗi</SelectItem>
                        <SelectItem value="interrupted">Ngắt</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Dự án</TableHead>
                                <TableHead>Run ID</TableHead>
                                <TableHead>Thời gian</TableHead>
                                <TableHead className="text-center">Files</TableHead>
                                <TableHead className="text-center">Duration</TableHead>
                                <TableHead>Trạng thái</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSessions.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Không tìm thấy phiên nào</TableCell></TableRow>
                            ) : filteredSessions.map((session) => (
                                <TableRow key={session.id} className="cursor-pointer" onClick={() => handleExpand(session.id)}>
                                    <TableCell>{expandedSession === session.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</TableCell>
                                    <TableCell className="font-medium">{session.projectName}</TableCell>
                                    <TableCell className="text-xs font-mono text-muted-foreground">{session.runId}</TableCell>
                                    <TableCell className="text-sm">{fmt(session.timestamp)}</TableCell>
                                    <TableCell className="text-center">{session.filesCount}</TableCell>
                                    <TableCell className="text-center">{session.executionDurationSeconds}s</TableCell>
                                    <TableCell>{statusBadge(session.status)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {expandedSession && (
                <Card>
                    <CardContent className="p-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" />Chi tiết file - {sessions.find(s => s.id === expandedSession)?.projectName}</h3>
                        {sessions.find(s => s.id === expandedSession)?.errorMessage && (
                            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                <p className="text-sm text-destructive flex items-center gap-2"><XCircle className="w-4 h-4" />{sessions.find(s => s.id === expandedSession)?.errorMessage}</p>
                            </div>
                        )}
                        {loading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div> : fileLogs[expandedSession]?.length ? (
                            <Table>
                                <TableHeader><TableRow><TableHead>Tên file</TableHead><TableHead>Đường dẫn</TableHead><TableHead>Kích thước</TableHead><TableHead>Modified</TableHead><TableHead className="text-right">Links</TableHead></TableRow></TableHeader>
                                <TableBody>{fileLogs[expandedSession].map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell className="font-medium"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><span className="truncate max-w-[200px]">{log.fileName}</span></div></TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{log.sourcePath}</TableCell>
                                        <TableCell className="text-xs"><HardDrive className="w-3 h-3 inline mr-1" />{fmtSize(log.fileSize)}</TableCell>
                                        <TableCell className="text-xs">{fmt(log.modifiedDate)}</TableCell>
                                        <TableCell className="text-right"><a href={log.sourceLink} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-accent rounded inline-block"><ExternalLink className="w-3.5 h-3.5 text-blue-500" /></a><a href={log.destLink} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-accent rounded inline-block ml-1"><ExternalLink className="w-3.5 h-3.5 text-emerald-500" /></a></TableCell>
                                    </TableRow>
                                ))}</TableBody>
                            </Table>
                        ) : <p className="text-muted-foreground text-center py-4 text-sm">Không có file log</p>}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
