'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useLogin } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';

const schema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    await login.mutateAsync(values);
    router.push('/chat');
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-lg font-semibold">
          Campus<span className="gradient-text">Brain</span>
        </Link>
        <div className="glass rounded-2xl p-8">
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Log in to continue.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Input placeholder="Email" type="email" {...register('email')} />
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>
            <div>
              <Input
                placeholder="Password"
                type="password"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            {login.isError && (
              <p className="text-sm text-red-400">
                {login.error instanceof ApiError
                  ? login.error.message
                  : 'Login failed.'}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? <Spinner /> : 'Log in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            No account?{' '}
            <Link href="/register" className="text-accent hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
