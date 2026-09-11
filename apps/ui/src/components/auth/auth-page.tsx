import Link from "next/link";
import Logo from "@/components/mine/logo";

type AuthPageProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function AuthPage({ title, description, children }: AuthPageProps) {
  return (
    <section className="flex min-h-screen bg-background px-4 py-16 md:py-32">
      <div className="m-auto h-fit w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card/80 p-6">
          <Link href="/" aria-label="go home">
            <Logo />
          </Link>
          <h1 className="mb-1 mt-4 text-xl font-semibold text-foreground">{title}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{description}</p>
          {children}
        </div>
      </div>
    </section>
  );
}
