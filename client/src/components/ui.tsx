import { ButtonHTMLAttributes, InputHTMLAttributes, forwardRef } from "react";

export function Button({
  className = "",
  children,
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      className={`inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-500 px-5 font-semibold text-white transition hover:bg-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:opacity-60 ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? "Aguarde..." : children}
    </button>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string }
>(({ label, id, className = "", ...props }, ref) => {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/70">
        {label}
      </span>
      <input
        ref={ref}
        id={id}
        className={`h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-ink outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${className}`}
        {...props}
      />
    </label>
  );
});
Input.displayName = "Input";

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}
