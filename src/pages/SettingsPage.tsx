import { useState } from 'react';
import { Settings, Save, Bell, Clock, Database, Webhook, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAppContext } from '@/context/AppContext';
import type { AppSettings } from '@/types/types';

export function SettingsPage() {
    const { state, updateSettings, setTheme } = useAppContext();
    const [form, setForm] = useState<AppSettings>({ ...state.settings });
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSettings(form);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } finally { setSaving(false); }
    };

    const handleReset = () => setForm({ ...state.settings });

    const update = (key: keyof AppSettings, value: any) => setForm(prev => ({ ...prev, [key]: value }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cài đặt</h1>
                    <p className="text-muted-foreground mt-1">Cấu hình hệ thống đồng bộ</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset} className="gap-2"><RotateCcw className="w-4 h-4" />Reset</Button>
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                        {saved ? <><CheckCircle2 className="w-4 h-4" />Đã lưu</> : <><Save className="w-4 h-4" />Lưu cài đặt</>}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />Cấu hình Sync</CardTitle>
                        <CardDescription>Các thông số điều khiển quá trình đồng bộ</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cutoff">Sync Cutoff (giây)</Label>
                            <Input id="cutoff" type="number" value={form.syncCutoffSeconds} onChange={e => update('syncCutoffSeconds', Number(e.target.value))} />
                            <p className="text-xs text-muted-foreground">Thời gian tối đa cho mỗi phiên sync. Sau thời gian này, hệ thống sẽ thực hiện Safe Exit.</p>
                        </div>
                        <Separator />
                        <div className="grid gap-2">
                            <Label htmlFor="schedule">Lịch chạy mặc định (Cron)</Label>
                            <Input id="schedule" value={form.defaultScheduleCron} onChange={e => update('defaultScheduleCron', e.target.value)} placeholder="0 */6 * * *" />
                            <p className="text-xs text-muted-foreground">Biểu thức Cron cho lịch chạy tự động. VD: <code className="bg-muted px-1 rounded">0 */6 * * *</code> = mỗi 6 giờ</p>
                        </div>
                        <Separator />
                        <div className="grid gap-2">
                            <Label htmlFor="retries">Số lần retry tối đa</Label>
                            <Input id="retries" type="number" value={form.maxRetries} onChange={e => update('maxRetries', Number(e.target.value))} />
                            <p className="text-xs text-muted-foreground">Áp dụng khi gặp lỗi Drive API 429 (Too many requests)</p>
                        </div>
                        <Separator />
                        <div className="grid gap-2">
                            <Label htmlFor="batch">Batch size</Label>
                            <Input id="batch" type="number" value={form.batchSize} onChange={e => update('batchSize', Number(e.target.value))} />
                            <p className="text-xs text-muted-foreground">Số file tối đa ghi vào Firestore trong một lần batch write</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />Thông báo</CardTitle>
                            <CardDescription>Cấu hình webhook và thông báo</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div><Label>Bật thông báo</Label><p className="text-xs text-muted-foreground mt-0.5">Gửi thông báo qua Google Chat sau mỗi phiên sync</p></div>
                                <Switch checked={form.enableNotifications} onCheckedChange={v => update('enableNotifications', v)} />
                            </div>
                            <Separator />
                            <div className="grid gap-2">
                                <Label htmlFor="webhook">Google Chat Webhook URL</Label>
                                <Input id="webhook" value={form.webhookUrl} onChange={e => update('webhookUrl', e.target.value)} placeholder="https://chat.googleapis.com/v1/spaces/..." className="font-mono text-xs" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5 text-primary" />Firebase</CardTitle>
                            <CardDescription>Kết nối Firestore database</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="fbProject">Firebase Project ID</Label>
                                <Input id="fbProject" value={form.firebaseProjectId} onChange={e => update('firebaseProjectId', e.target.value)} placeholder="my-project-id" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-primary" />Giao diện</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div><Label>Dark Mode</Label><p className="text-xs text-muted-foreground mt-0.5">Hiện tại: {state.theme}</p></div>
                                <div className="flex gap-1">
                                    {(['light', 'dark', 'system'] as const).map(t => (
                                        <Button key={t} variant={state.theme === t ? 'default' : 'outline'} size="sm" onClick={() => setTheme(t)} className="capitalize">{t}</Button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
