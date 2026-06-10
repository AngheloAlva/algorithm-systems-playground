import type { Metadata } from "next";
import { EmptyState } from "@/components/layout/empty-state";
import { MODULES } from "@/config/modules";

const mod = MODULES.find((m) => m.slug === "graphs")!;

export const metadata: Metadata = {
  title: `${mod.title} — Algorithm Playground`,
  description: mod.description,
};

export default function GraphsPage() {
  return (
    <EmptyState
      title={mod.title}
      description={mod.description}
      icon={mod.icon}
    />
  );
}
