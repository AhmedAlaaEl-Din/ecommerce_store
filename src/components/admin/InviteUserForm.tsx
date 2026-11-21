"use client";

import { useActionState } from "react";
import { inviteUserAction, type InviteState } from "@/app/admin/(panel)/users/actions";
import { AlertIcon } from "../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

export function InviteUserForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteUserAction, {});
  return (
    <div className="flex flex-col gap-4">
      {state.created && (
        <div
          role="status"
          className="bg-primary-soft text-ink rounded-md p-3 text-sm"
          data-testid="invite-created"
        >
          <p className="font-semibold">Account created for {state.created.email}.</p>
          <p className="mt-1">
            One-time password (shown only now; copy it and share it privately):
          </p>
          <p
            className="bg-surface mt-2 rounded-sm px-2 py-1.5 font-mono text-sm break-all select-all"
            data-testid="invite-password"
          >
            {state.created.password}
          </p>
        </div>
      )}
      <form
        action={action}
        className="flex flex-col gap-3"
        key={state.created?.email ?? "invite"}
        data-testid="invite-form"
      >
        {state.error && (
          <p
            role="alert"
            className="bg-danger-soft text-danger flex gap-2 rounded-md p-2.5 text-sm"
          >
            <AlertIcon size={18} className="mt-0.5 shrink-0" /> {state.error}
          </p>
        )}
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="off"
          required
          maxLength={254}
        />
        <Input label="Name" name="name" maxLength={80} autoComplete="off" />
        <Select
          label="Role"
          name="role"
          defaultValue="staff"
          options={[
            { value: "staff", label: "Staff (orders, products, stock)" },
            { value: "admin", label: "Admin (everything)" },
          ]}
        />
        <div>
          <Button type="submit" loading={pending} data-testid="invite-submit">
            Create account
          </Button>
        </div>
      </form>
    </div>
  );
}
