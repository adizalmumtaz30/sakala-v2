import type { ReactNode } from "react";
import styles from "./JadwalPremium.module.css";

export default function JadwalLayout({ children }: { children: ReactNode }) {
  return <div className={styles.workspace}>{children}</div>;
}
