import Link from "next/link";

export function AuthCard({ children, title, description }: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="auth-page">
      <div className="auth-brand" aria-label="Nexa CRM">
        <span aria-hidden="true" className="brand-mark">N</span>
        <span className="brand-name">Nexa CRM</span>
      </div>
      <section aria-labelledby="auth-title" className="auth-card">
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </section>
      <p className="auth-footer"><Link href="/auth/sign-in">Nexa CRM</Link> · Secure workspace access</p>
    </main>
  );
}
