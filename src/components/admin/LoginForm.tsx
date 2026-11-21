"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/login/actions";
import { AlertIcon } from "../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {state.error && (
        <div
          role="alert"
          className="bg-danger-soft text-danger flex gap-2 rounded-md p-3 text-sm"
          data-testid="login-error"
        >
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
        maxLength={254}
        defaultValue={state.email}
        key={state.email ?? "email"}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={256}
      />
      <Button type="submit" loading={pending} fullWidth data-testid="login-submit">
        Sign in
      </Button>
    </form>
  );
}
