export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
