'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { AxiosError } from 'axios';
import { Upload } from 'lucide-react';

const sessionSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(500).optional(),
  rawLog: z.string().min(20, 'Log content is too short'),
  tags: z.string().optional(),
});

type SessionForm = z.infer<typeof sessionSchema>;

export default function NewSessionPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pasteMode, setPasteMode] = useState(true);
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      title: 'Production Log Analysis',
      rawLog: '',
    },
  });

  const rawLog = watch('rawLog');

  const onSubmit = async (data: SessionForm) => {
    if (!accessToken) return;

    setIsSubmitting(true);

    try {
      const tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];

      const res = await apiClient.post('/sessions', {
        title: data.title,
        description: data.description,
        rawLog: data.rawLog,
        tags,
      });

      const sessionId = res.data.data.session.id;
      toast.success('Session created. Starting AI analysis...');

      // Trigger analysis immediately
      await apiClient.post(`/sessions/${sessionId}/analyze`, {});

      router.push(`/dashboard/sessions/${sessionId}`);
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data?.error as string) || 'Failed to create session'
          : 'Failed to create session';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large (max 20MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setValue('rawLog', content);
      setValue('title', file.name.replace(/\.[^/.]+$/, ''));
      toast.success('Log file loaded');
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">New Log Analysis</h1>
        <p className="text-zinc-400 mt-1">Paste logs or upload a file for AI-powered threat detection</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="title">Session Title</Label>
            <Input id="title" {...register('title')} className="mt-1.5" placeholder="Production SSH Logs" />
            {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input id="tags" {...register('tags')} className="mt-1.5" placeholder="ssh, production, auth" />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea 
            id="description" 
            {...register('description')} 
            className="mt-1.5" 
            placeholder="Describe the log source and context..."
            rows={2}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Log Content</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={pasteMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPasteMode(true)}
              >
                Paste Text
              </Button>
              <Button
                type="button"
                variant={!pasteMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPasteMode(false)}
              >
                Upload File
              </Button>
            </div>
          </div>

          {pasteMode ? (
            <Textarea
              {...register('rawLog')}
              className="font-mono text-sm h-[380px] bg-zinc-950"
              placeholder="Paste your log content here..."
            />
          ) : (
            <div className="border border-dashed border-zinc-700 rounded-xl p-12 text-center bg-zinc-900">
              <Upload className="mx-auto h-10 w-10 text-zinc-400 mb-4" />
              <p className="text-sm text-zinc-400 mb-4">Upload .log, .txt, or any text file (max 20MB)</p>
              <input 
                type="file" 
                accept=".log,.txt,.csv" 
                onChange={handleFileUpload}
                className="hidden" 
                id="file-upload" 
              />
              <Button type="button" variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                Choose File
              </Button>
            </div>
          )}

          {rawLog && (
            <div className="mt-2 text-xs text-zinc-500 flex justify-between">
              <span>{rawLog.length.toLocaleString()} characters</span>
              <span>~{Math.round(rawLog.split('\n').length)} lines</span>
            </div>
          )}
          {errors.rawLog && <p className="text-red-400 text-sm mt-1">{errors.rawLog.message}</p>}
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[180px]">
            {isSubmitting ? 'Creating & Analyzing...' : 'Create & Analyze with AI'}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
