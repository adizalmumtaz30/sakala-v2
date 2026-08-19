import { forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, options, placeholder = "Klik untuk memilih", className = "", id, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-[12.5px] font-medium text-ink-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          className={`h-11 w-full rounded-xl border bg-surface px-3.5 text-[13.5px] text-ink-900 outline-none transition-colors focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/15 ${
            error ? "border-rose" : "border-border"
          } ${className}`}
          {...props}
        >
          {!props.value && !props.defaultValue && <option value="">{placeholder} ▾</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? <p className="text-[11.5px] text-rose">{error}</p> : hint ? <p className="text-[11.5px] text-ink-400">{hint}</p> : null}
      </div>
    );
  }
);

SelectField.displayName = "SelectField";
export default SelectField;
