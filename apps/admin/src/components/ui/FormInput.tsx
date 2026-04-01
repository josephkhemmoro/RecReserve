"use client";

import { cn } from "@/lib/cn";

interface FormInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  type?: "text" | "email" | "number" | "tel" | "password" | "url" | "time" | "date";
  disabled?: boolean;
  helperText?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function FormInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  disabled,
  helperText,
  min,
  max,
  step,
  className,
}: FormInputProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={cn(
          "w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand",
          error ? "border-error" : "border-slate-300",
          disabled && "bg-slate-100 text-slate-400 cursor-not-allowed"
        )}
      />
      {error && <p className="text-xs text-error mt-1.5">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-400 mt-1.5">{helperText}</p>}
    </div>
  );
}
