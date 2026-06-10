"use client"

import { cn } from "@/lib/utils"

interface ControlPanelProps {
	title: string
	className?: string
	children?: React.ReactNode
}

/**
 * ControlPanel — a titled panel wrapper for module-specific controls.
 * Phase 0: shell only — no internal state or algorithm logic.
 * Phase 1+: wrap sliders, selects, and action buttons for each module.
 */
export function ControlPanel({ title, className, children }: ControlPanelProps) {
	return (
		<div
			className={cn("border-border bg-card flex flex-col gap-3 rounded-lg border p-4", className)}
		>
			<h2 className="text-card-foreground text-sm font-semibold">{title}</h2>
			{children}
		</div>
	)
}
