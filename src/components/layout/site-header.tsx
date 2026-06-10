import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function SiteHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      {/* Sidebar toggle — keyboard accessible, aria-label set by shadcn SidebarTrigger */}
      <SidebarTrigger className="-ml-1" />

      {/* Flexible spacer */}
      <div className="flex-1" />

      {/* Theme toggle */}
      <ThemeToggle />
    </header>
  );
}
