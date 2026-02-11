// ==========================================
// Projects Page - Project Management
// ==========================================

import { useState } from 'react';
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
import { useAppContext } from '@/context/AppContext';
import { gasService } from '@/services/gasService';
import type { Project } from '@/types/types';

export function ProjectsPage() {
    const { state, createProject, updateProject, deleteProject } = useAppContext();
    const [search, setSearch] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sourceFolderLink: '',
        destFolderLink: '',
    });

    const filteredProjects = state.projects.filter(
        (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase())
    );

    const extractFolderId = (link: string): string => {
        const match = link.match(/folders\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : link;
    };

    const validateFolderLink = (link: string): boolean => {
        return /^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]+/.test(link) || /^[a-zA-Z0-9_-]{10,}$/.test(link);
    };

    const resetForm = () => {
        setFormData({ name: '', description: '', sourceFolderLink: '', destFolderLink: '' });
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

            {/* Project Cards Grid */}
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
            ) : (
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
                                </div>

                                <Separator />

                                {/* Stats */}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <FileCheck2 className="w-3.5 h-3.5" />
                                        <span>{project.filesCount} files</span>
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
            )}
        </div>
    );
}
