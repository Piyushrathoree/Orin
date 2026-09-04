import Link from "next/link";
import Logo from "@/components/mine/logo";
import AuthForm from "@/components/auth/auth-form";

export default function SignUpPage() {
  return (
    <section className="flex min-h-screen bg-background px-4 py-16 md:py-32">
      <div className="m-auto h-fit w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card/80 p-6">
          <Link href="/" aria-label="go home">
            <Logo />
          </Link>
          <h1 className="mb-1 mt-4 text-xl font-semibold text-foreground">
            Create your Orin account
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Save your projects and pick up where you left off.
          </p>
          <AuthForm mode="sign-up" />
        </div>
      </div>
    </section>
  );
}
