"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Always show generic success to prevent enumeration
    await requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setMessage("If an account exists, a reset link has been sent.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-bold">Reset Password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your email to receive a reset link.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full">Send Reset Link</Button>
      </form>

      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
    </main>
  );
}