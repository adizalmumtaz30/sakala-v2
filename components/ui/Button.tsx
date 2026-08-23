import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50",
  secondary: "border border-border bg-surface text-ink-900 hover:bg-surface-muted",
  ghost: "text-ink-700 hover:bg-surface-muted",
  danger: "bg-rose text-white hover:bg-rose/90",
  // Aksen SAKALA AI — dipakai khusus di halaman AI untuk membedakan tindakan
  // yang berasal dari rekomendasi AI dari navigasi biasa (yang tetap biru).
  accent: "bg-violet text-white hover:bg-violet/90 disabled:bg-violet/50 focus-visible:ring-violet/40",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3 text-[12.5px]",
  md: "h-11 px-4 text-[13.5px]",
  lg: "h-12 px-5 text-[14.5px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
        {...props}
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;
