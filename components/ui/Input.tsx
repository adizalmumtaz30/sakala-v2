import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[12.5px] font-medium text-ink-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={`h-11 rounded-xl border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15 ${
            error ? "border-rose" : "border-border"
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-[11.5px] text-rose">{error}</p>
        ) : hint ? (
          <p className="text-[11.5px] text-ink-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export default Input;
