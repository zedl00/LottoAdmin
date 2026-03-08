// useUtils — re-exports del store central
export { fmt, pct, hexToRgb, toggleTheme, applyTheme, themeMode, view, toasts, isDark } from '../store.js'
export function useUtils() {
  return { fmt, pct, hexToRgb, toggleTheme, applyTheme, themeMode, view, toasts, isDark }
}
import { fmt, pct, hexToRgb, toggleTheme, applyTheme, themeMode, view, toasts, isDark } from '../store.js'
