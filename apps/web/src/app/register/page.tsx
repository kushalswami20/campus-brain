'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useRegister } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';

const schema = z.object({
  fullName: z.string().min(2, 'Enter your name.'),
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(8, 'At least 8 characters.'),
  branch: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    await registerMutation.mutateAsync({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      branch: values.branch || undefined,
    });
    router.push('/chat');
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-lg font-semibold">
          Campus<span className="gradient-text">Brain</span>
        </Link>
        <div className="glass rounded-2xl p-8">
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted">Free to start.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Input placeholder="Full name" {...register('fullName')} />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.fullName.message}
                </p>
              )}
            </div>
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
            <Input placeholder="Branch (optional)" {...register('branch')} />

            {registerMutation.isError && (
              <p className="text-sm text-red-400">
                {registerMutation.error instanceof ApiError
                  ? registerMutation.error.message
                  : 'Registration failed.'}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? <Spinner /> : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-accent hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
