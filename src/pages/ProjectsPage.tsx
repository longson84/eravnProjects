// ==========================================
// Projects Page - Project Management
// ==========================================

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    FolderSync,
    ExternalLink,
    Play,
    Pause,
    Pencil,
    Trash2,
    RefreshCw,
    Clock,
    FileCheck2,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Loader2,
    LayoutGrid,
    List,
    Calendar,
    CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppContext } from '@/context/AppContext';
import { gasService } from '@/services/gasService';
import type { Project } from '@/types/types';
import { useQueryClient } from '@tanstack/react-query';

export function ProjectsPage() {
    const { state, createProject, updateProject, deleteProject } = useAppContext();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    
    // View mode state
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Load view mode from localStorage on mount
    useEffect(() => {
        const savedMode = localStorage.getItem('projects_view_mode');
        if (savedMode === 'grid' || savedMode === 'list') {
            setViewMode(savedMode);
        }
    }, []);

    // Save view mode when changed
    const handleViewModeChange = (mode: 'grid' | 'list') => {
        setViewMode(mode);
        localStorage.setItem('projects_view_mode', mode);
    };

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sourceFolderLink: '',
        destFolderLink: '',
        syncStartDate: new Date().toISOString().split('T')[0], // Default to today YYYY-MM-DD
    });

    const filteredProjects = state.projects.filter(
        (p) =>
            !p.isDeleted &&
            (p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase()))
    );

    const extractFolderId = (link: string): string => {
        const match = link.match(/folders\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : link;
    };

    const validateFolderLink = (link: string): boolean => {
        return /^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]+/.test(link) || /^[a-zA-Z0-9_-]{10,}$/.test(link);
    };

    const resetForm = () => {
        setFormData({ 
            name: '', 
            description: '', 
            sourceFolderLink: '', 
            destFolderLink: '',
            syncStartDate: new Date().toISOString().split('T')[0]
        });
        setEditingProject(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsCreateOpen(true);
    };

    const handleOpenEdit = (project: Project) => {
        setFormData({
            name: project.name,
            description: project.description,
            sourceFolderLink: project.sourceFolderLink,
            destFolderLink: project.destFolderLink,
            syncStartDate: project.syncStartDate || '',
        });
        setEditingProject(project);
        setIsCreateOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.sourceFolderLink || !formData.destFolderLink) return;
        if (!validateFolderLink(formData.sourceFolderLink) || !validateFolderLink(formData.destFolderLink)) return;

        const projectData: Partial<Project> = {
            name: formData.name,
            description: formData.description,
            sourceFolderLink: formData.sourceFolderLink,
            sourceFolderId: extractFolderId(formData.sourceFolderLink),
            destFolderLink: formData.destFolderLink,
            destFolderId: extractFolderId(formData.destFolderLink),
            syncStartDate: formData.syncStartDate || undefined, // undefined if empty string
            status: 'active',
        };

        if (editingProject) {
            await updateProject({ ...editingProject, ...projectData });
        } else {
            await createProject(projectData);
        }

        setIsCreateOpen(false);
        resetForm();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Bạn có chắc chắn muốn xóa dự án này?')) {
            await deleteProject(id);
        }
    };

    const handleSync = async (projectId: string) => {
        setSyncingId(projectId);
        try {
            await gasService.runSyncProject(projectId);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
        } finally {
            setSyncingId(null);
        }
    };

    const handleToggleStatus = async (project: Project) => {
        const newStatus = project.status === 'active' ? 'paused' : 'active';
        await updateProject({ ...project, status: newStatus });
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Chưa có';
        return new Date(dateStr).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Hoạt động</Badge>;
            case 'paused':
                return <Badge variant="warning"><Pause className="w-3 h-3 mr-1" />Tạm dừng</Badge>;
            case 'error':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Lỗi</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dự án</h1>
                    <p className="text-muted-foreground mt-1">
                        Quản lý các cặp thư mục đồng bộ Source → Destination
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-muted rounded-md p-1 border">
                        <Button 
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleViewModeChange('grid')}
                            title="Dạng lưới"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </Button>
                        <Button 
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleViewModeChange('list')}
                            title="Dạng danh sách"
                        >
                            <List className="w-4 h-4" />
                        </Button>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleOpenCreate} className="gap-2">
                                <Plus className="w-4 h-4" /> Thêm dự án
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingProject ? 'Chỉnh sửa dự án' : 'Thêm dự án mới'}
                                </DialogTitle>
                                <DialogDescription>
                                    Cấu hình cặp thư mục Source và Destination cho đồng bộ tự động.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Tên dự án *</Label>
                                    <Input
                                        id="name"
                                        placeholder="VD: Dự án Vinhomes Grand Park"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">Mô tả</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Mô tả ngắn gọn về dự án..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="syncStartDate" className="flex items-center gap-2">
                                        Ngày bắt đầu đồng bộ
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="max-w-xs">Chỉ đồng bộ các file được tạo hoặc sửa đổi từ ngày này trở đi. Bỏ trống để đồng bộ toàn bộ lịch sử.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </Label>
                                    <div className="relative">
                                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="syncStartDate"
                                            type="date"
                                            className="pl-9"
                                            value={formData.syncStartDate}
                                            onChange={(e) => setFormData({ ...formData, syncStartDate: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Mặc định là hôm nay. Chỉ nên chỉnh sửa nếu bạn muốn đồng bộ dữ liệu cũ hơn.
                                    </p>
                                </div>
                                <Separator />
                                <div className="grid gap-2">
                                    <Label htmlFor="sourceLink">
                                        Source Folder Link *
                                        <span className="text-xs text-muted-foreground ml-2">(Link hoặc ID thư mục đối tác)</span>
                                    </Label>
                                    <Input
                                        id="sourceLink"
                                        placeholder="https://drive.google.com/drive/folders/..."
                                        value={formData.sourceFolderLink}
                                        onChange={(e) => setFormData({ ...formData, sourceFolderLink: e.target.value })}
                                        className={formData.sourceFolderLink && !validateFolderLink(formData.sourceFolderLink) ? 'border-red-500' : ''}
                                    />
                                    {formData.sourceFolderLink && !validateFolderLink(formData.sourceFolderLink) && (
                                        <p className="text-xs text-red-500 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> Link không hợp lệ
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="destLink">
                                        Destination Folder Link *
                                        <span className="text-xs text-muted-foreground ml-2">(Link thư mục nội bộ)</span>
                                    </Label>
                                    <Input
                                        id="destLink"
                                        placeholder="https://drive.google.com/drive/folders/..."
                                        value={formData.destFolderLink}
                                        onChange={(e) => setFormData({ ...formData, destFolderLink: e.target.value })}
                                        className={formData.destFolderLink && !validateFolderLink(formData.destFolderLink) ? 'border-red-500' : ''}
                                    />
                                    {formData.destFolderLink && !validateFolderLink(formData.destFolderLink) && (
                                        <p className="text-xs text-red-500 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> Link không hợp lệ
                                        </p>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
                                    Hủy
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!formData.name || !formData.sourceFolderLink || !formData.destFolderLink}
                                >
                                    {editingProject ? 'Cập nhật' : 'Tạo dự án'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Tìm kiếm dự án..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Content */}
            {state.isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : filteredProjects.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12">
                    <FolderSync className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">Chưa có dự án nào</h3>
                    <p className="text-sm text-muted-foreground mt-1">Thêm dự án mới để bắt đầu đồng bộ</p>
                </Card>
            ) : viewMode === 'grid' ? (
                // GRID VIEW
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredProjects.map((project) => (
                        <Card key={project.id} className="group relative overflow-hidden hover:shadow-lg transition-all duration-200">
                            {/* Status indicator stripe */}
                            <div className={`absolute top-0 left-0 right-0 h-1 ${project.status === 'active' ? 'bg-emerald-500' :
                                    project.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                                }`} />

                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <CardTitle className="text-base truncate">{project.name}</CardTitle>
                                        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                                    </div>
                                    {getStatusBadge(project.status)}
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {/* Folder links */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-muted-foreground w-10 shrink-0">SRC</span>
                                        <a
                                            href={project.sourceFolderLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline truncate flex items-center gap-1"
                                        >
                                            {project.sourceFolderId.slice(0, 20)}...
                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                        </a>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-muted-foreground w-10 shrink-0">DEST</span>
                                        <a
                                            href={project.destFolderLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline truncate flex items-center gap-1"
                                        >
                                            {project.destFolderId.slice(0, 20)}...
                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                        </a>
                                    </div>
                                    
                                    {project.syncStartDate && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                                            <span className="text-muted-foreground w-10 shrink-0">START</span>
                                            <div className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded">
                                                <Calendar className="w-3 h-3" />
                                                <span>{project.syncStartDate}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <Separator />

                                {/* Stats */}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <FileCheck2 className="w-3.5 h-3.5" />
                                        <span>Đã sync: {project.filesCount} files</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{formatDate(project.lastSyncTimestamp)}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 gap-1"
                                        onClick={() => handleSync(project.id)}
                                        disabled={syncingId === project.id || project.status === 'paused'}
                                    >
                                        {syncingId === project.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-3.5 h-3.5" />
                                        )}
                                        Sync
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleToggleStatus(project)}
                                        title={project.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}
                                    >
                                        {project.status === 'active' ? (
                                            <Pause className="w-3.5 h-3.5" />
                                        ) : (
                                            <Play className="w-3.5 h-3.5" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenEdit(project)}
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDelete(project.id)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                // LIST VIEW (Table)
                <div className="rounded-md border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">Dự án</TableHead>
                                <TableHead className="w-[120px]">Trạng thái</TableHead>
                                <TableHead>Source / Destination</TableHead>
                                <TableHead className="w-[130px]">Start Sync</TableHead>
                                <TableHead className="w-[150px]">Last Sync</TableHead>
                                <TableHead className="w-[120px]">Files Synced</TableHead>
                                <TableHead className="w-[100px] text-right">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProjects.map((project) => (
                                <TableRow key={project.id}>
                                    <TableCell>
                                        <div className="font-medium">{project.name}</div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 text-xs max-w-[200px]">
                                            <a href={project.sourceFolderLink} target="_blank" className="flex items-center gap-1 text-muted-foreground hover:text-primary truncate">
                                                <span className="font-semibold">SRC:</span> {project.sourceFolderId}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                            <a href={project.destFolderLink} target="_blank" className="flex items-center gap-1 text-muted-foreground hover:text-primary truncate">
                                                <span className="font-semibold">DST:</span> {project.destFolderId}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {project.syncStartDate ? (
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {project.syncStartDate}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {formatDate(project.lastSyncTimestamp)}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {project.filesCount} files
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleSync(project.id)}
                                                disabled={syncingId === project.id || project.status === 'paused'}
                                                title="Sync ngay"
                                            >
                                                {syncingId === project.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="w-4 h-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleOpenEdit(project)}
                                                title="Chỉnh sửa"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(project.id)}
                                                title="Xóa"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
