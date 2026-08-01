'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import { LogoMark } from '@/components/brand/Logo';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await axios.post('/api/auth/login', data);
      
      if (response.data.data?.accessToken) {
        setAuth(response.data.data.user, response.data.data.accessToken);
        toast.success('Logged in successfully');
        router.push('/dashboard');
      }
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data?.error as string) || 'Login failed'
          : 'Login failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-6 flex items-center justify-center">
            <LogoMark animated className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">
              LogSentinel
            </span>
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">Sign in to your AI threat-analysis workspace</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="analyst@company.com"
                {...register('email')}
                className="mt-1.5"
              />
              {errors.email && (
                <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="mt-1.5"
              />
              {errors.password && (
                <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full bg-white text-black hover:bg-zinc-200" 
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-white hover:underline">
              Create one
            </Link>
          </div>
        </div>

        {/* Demo credentials are dev-only seed data (see prisma/seed.ts). Rendered
            only outside production so production builds never surface a working
            login hint. */}
        {process.env.NODE_ENV === 'development' && (
          <p className="text-center text-xs text-zinc-500">
            Demo: analyst@seclab.io / Demo1234!
          </p>
        )}
      </div>
    </div>
  );
}
