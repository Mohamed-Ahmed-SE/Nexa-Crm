"use client";

import { useState } from "react";

type PasswordFieldProps = {
  id: string;
  label: string;
  name: string;
  autoComplete: string;
  minLength?: number;
};

export function PasswordField({ id, label, name, autoComplete, minLength }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input autoComplete={autoComplete} id={id} minLength={minLength} name={name} required type={isVisible ? "text" : "password"} />
        <button aria-label={isVisible ? "Hide password" : "Show password"} className="password-toggle" onClick={() => setIsVisible(!isVisible)} type="button">
          {isVisible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
