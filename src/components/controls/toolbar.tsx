import { cn } from "@/lib/utils"

interface ToolbarProps {
	className?: string
	children?: React.ReactNode
}

/**
 * Toolbar — a horizontal container for module canvas action buttons.
 * Phase 0: shell only — no internal state or algorithm logic.
 * Phase 1+: populate with play/pause/reset controls per module.
 */
export function Toolbar({ className, children }: ToolbarProps) {
	return (
		<div
			className={cn(
				"border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2",
				className
			)}
		>
			{children}
		</div>
	)
}
