import Link from 'next/link';
import { ArrowRight, FileText, MessageSquare, Sparkles } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Upload anything',
    body: 'PDFs, notes, previous-year papers, slides, images — with OCR.',
  },
  {
    icon: Sparkles,
    title: 'Multi-agent RAG',
    body: 'A 9-agent pipeline retrieves, reranks, verifies, and cites.',
  },
  {
    icon: MessageSquare,
    title: 'Grounded answers',
    body: 'Every answer is backed by your material — no hallucinations.',
  },
];

export default function LandingPage(): React.ReactElement {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-primary/15 to-transparent blur-2xl" />

      <nav className="flex w-full items-center justify-between py-6">
        <span className="text-lg font-semibold">
          Campus<span className="gradient-text">Brain</span>
        </span>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-muted hover:text-fg">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-fg hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </nav>

      <section className="mt-24 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <Sparkles className="h-3 w-3 text-accent" />
          Grounded, cited answers from your own material
        </div>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight">
          Your entire syllabus,{' '}
          <span className="gradient-text">answerable.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
          Upload your notes and papers. Ask anything. CampusBrain answers only
          from your material, with citations you can trust.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-fg hover:opacity-90"
          >
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border px-5 py-3 font-medium hover:bg-surface-2"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="mt-24 grid w-full gap-4 pb-24 sm:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="glass rounded-2xl p-6">
            <feature.icon className="h-6 w-6 text-accent" />
            <h3 className="mt-4 font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted">{feature.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
