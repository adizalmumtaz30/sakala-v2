"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { login, type LoginState } from "./actions";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-7 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <GraduationCap size={22} />
          </div>
          <h1 className="text-[18px] font-bold text-ink-900">Masuk ke SAKALA</h1>
          <p className="text-[12.5px] text-ink-500">Platform manajemen jadwal sekolah</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Input label="Email" name="email" type="email" autoComplete="username" required autoFocus />
          <Input label="Password" name="password" type="password" autoComplete="current-password" required />

          {state.error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose">
              {state.error}
            </p>
          )}

          <Button type="submit" loading={pending} className="mt-1 w-full">
            Masuk
          </Button>
        </form>
      </div>
    </div>
  );
}
