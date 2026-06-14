"use client"

/**
 * ModuleGrid — client component rendering the module cards with TransitionLink.
 *
 * Separated from the server-component home page so TransitionLink (a client
 * component that hooks into useRouter) can be used for the "Explore" links
 * without forcing the whole page into the client boundary.
 */

import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card"
import { MODULE_STATUS, MODULES } from "@/config/modules"
import { ArrowRightIcon } from "lucide-react"
import { TransitionLink } from "@/components/transitions/transition-link"

export function ModuleGrid() {
	return (
		<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" role="list">
			{MODULES.map((mod) => {
				const Icon = mod.icon
				const isAvailable = mod.status === MODULE_STATUS.AVAILABLE

				return (
					<li key={mod.slug}>
						<Card className="flex h-full flex-col transition-shadow hover:shadow-md">
							<CardHeader>
								<div className="mb-2 flex items-center gap-3">
									<div className="border-border bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg border">
										<Icon className="size-5" aria-hidden="true" />
									</div>
									<h2 className="text-foreground text-base leading-none font-semibold">
										{mod.title}
									</h2>
								</div>
								<CardDescription>{mod.description}</CardDescription>
							</CardHeader>

							<CardContent className="flex-1" />

							<CardFooter className="flex items-center justify-between">
								<span
									className={
										isAvailable
											? "border-border bg-primary/10 text-primary inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
											: "border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
									}
								>
									{isAvailable ? "Available" : "Coming soon"}
								</span>

								<TransitionLink
									href={`/${mod.slug}`}
									className="text-foreground focus-visible:ring-ring inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
									aria-label={`Open ${mod.title} module`}
								>
									Explore
									<ArrowRightIcon className="size-3.5" aria-hidden="true" />
								</TransitionLink>
							</CardFooter>
						</Card>
					</li>
				)
			})}
		</ul>
	)
}
