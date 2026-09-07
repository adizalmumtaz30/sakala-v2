import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Tombol utama (Tambah/Import/Simpan, dst di seluruh SAKALA) — gradient
// biru->violet + glow + tekan-turun, bukan flat 1 warna. Satu komponen
// dipakai di semua halaman (Guru, Mata Pelajaran, Kelas, Ruangan,
// Pembagian Mengajar, Target JP, dst), jadi berlaku otomatis di mana-mana.
const variantClass: Record<Variant, string> = {
  primary:
    "text-white bg-[linear-gradient(135deg,var(--color-brand)_0%,var(--color-violet)_100%)] " +
    "shadow-[inset_0_1px_1px_rgba(255,255,255,.22),0_2px_8px_-2px_color-mix(in_srgb,var(--color-brand)_55%,transparent)] " +
    "hover:brightness-[1.08] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,.22),0_4px_14px_-3px_color-mix(in_srgb,var(--color-violet)_60%,transparent)] " +
    "active:scale-[0.97] disabled:opacity-50 disabled:hover:brightness-100",
  secondary: "border border-border bg-surface text-ink-900 hover:border-brand-600/30 hover:bg-surface-muted active:scale-[0.97]",
  ghost: "text-ink-700 hover:bg-surface-muted active:scale-[0.97]",
  danger:
    "text-white bg-[linear-gradient(135deg,var(--color-rose)_0%,color-mix(in_srgb,var(--color-rose)_75%,black)_100%)] " +
    "shadow-[0_2px_8px_-2px_color-mix(in_srgb,var(--color-rose)_50%,transparent)] hover:brightness-[1.08] active:scale-[0.97]",
  // Aksen SAKALA AI — dipakai khusus di halaman AI untuk membedakan tindakan
  // yang berasal dari rekomendasi AI dari navigasi biasa (yang tetap biru).
  accent:
    "text-white bg-[linear-gradient(135deg,var(--color-violet)_0%,color-mix(in_srgb,var(--color-violet)_72%,black)_100%)] " +
    "shadow-[0_2px_8px_-2px_color-mix(in_srgb,var(--color-violet)_55%,transparent)] hover:brightness-[1.08] active:scale-[0.97] focus-visible:ring-violet/40",
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
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[filter,box-shadow,transform] duration-200 ease-[cubic-bezier(0.16,0.8,0.24,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed disabled:active:scale-100 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
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
