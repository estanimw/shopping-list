"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LockKeyhole, Mail, ShoppingBasket, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface AuthFormProps {
  mode: "sign-in" | "sign-up";
}

export function AuthForm({ mode }: AuthFormProps) {
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            email,
            name: name.trim(),
            password,
          })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "No pudimos procesar tus datos. Intentá de nuevo.");
        return;
      }

      window.location.assign("/");
    } catch {
      setError("No pudimos conectar. Revisá los datos e intentá de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div aria-hidden="true" className="auth-page__ambient auth-page__ambient--one" />
      <div aria-hidden="true" className="auth-page__ambient auth-page__ambient--two" />

      <section aria-labelledby="auth-title" className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand__icon">
            <ShoppingBasket aria-hidden="true" size={23} strokeWidth={2.2} />
          </span>
          <span>Compra Ligera</span>
        </div>

        <div className="auth-card__heading">
          <p className="eyebrow">Tu espacio personal</p>
          <h1 id="auth-title">
            {isSignUp ? "Empezá tu lista." : "Qué bueno verte de nuevo."}
          </h1>
          <p>
            {isSignUp
              ? "Creá tu cuenta para guardar tus compras separadas del resto."
              : "Ingresá para volver a tu lista de compras."}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp ? (
            <label className="auth-field" htmlFor="name">
              <span>
                <UserRound aria-hidden="true" size={15} /> Tu nombre
              </span>
              <input
                autoComplete="name"
                disabled={isSubmitting}
                id="name"
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                placeholder="Por ejemplo, Ana"
                required
                value={name}
              />
            </label>
          ) : null}

          <label className="auth-field" htmlFor="email">
            <span>
              <Mail aria-hidden="true" size={15} /> Email
            </span>
            <input
              autoComplete="email"
              disabled={isSubmitting}
              id="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@email.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="auth-field" htmlFor="password">
            <span>
              <LockKeyhole aria-hidden="true" size={15} /> Contraseña
            </span>
            <input
              autoComplete={isSignUp ? "new-password" : "current-password"}
              disabled={isSubmitting}
              id="password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isSignUp ? "Al menos 8 caracteres" : "Tu contraseña"}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="auth-submit" disabled={isSubmitting} type="submit">
            <span>
              {isSubmitting
                ? isSignUp
                  ? "Creando cuenta…"
                  : "Ingresando…"
                : isSignUp
                  ? "Crear mi cuenta"
                  : "Ingresar a mi lista"}
            </span>
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? "¿Ya tenés una cuenta?" : "¿Es tu primera vez?"}{" "}
          <Link href={isSignUp ? "/sign-in" : "/sign-up"}>
            {isSignUp ? "Ingresá" : "Creá una cuenta"}
          </Link>
        </p>
      </section>
    </main>
  );
}
