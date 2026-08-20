import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-hover hover:text-text cursor-pointer " +
        (className || "")
      }
    >
      <Sun className="size-4.5 scale-100 dark:scale-0 transition-transform duration-200" />
      <Moon className="absolute size-4.5 scale-0 dark:scale-100 transition-transform duration-200" />
    </button>
  );
}
