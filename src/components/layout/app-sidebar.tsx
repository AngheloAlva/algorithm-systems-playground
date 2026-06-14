"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HomeIcon } from "lucide-react"

import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar"
import { MODULES } from "@/config/modules"
import { TransitionLink } from "@/components/transitions/transition-link"

export function AppSidebar() {
	const pathname = usePathname()

	return (
		<Sidebar collapsible="offcanvas">
			{/* Brand header */}
			<SidebarHeader className="border-border border-b px-4 py-3">
				<Link
					href="/"
					className="text-foreground focus-visible:ring-ring flex items-center gap-2 rounded-sm text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
				>
					<span aria-hidden="true" className="text-primary">
						⬡
					</span>
					<span>Algorithm Playground</span>
				</Link>
			</SidebarHeader>

			<SidebarContent>
				<nav aria-label="Main navigation">
					{/* Home link */}
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										isActive={pathname === "/"}
										tooltip="Home"
										render={<TransitionLink href="/" aria-current={pathname === "/" ? "page" : undefined} />}
									>
										<HomeIcon />
										<span>Home</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					{/* Module links */}
					<SidebarGroup>
						<SidebarGroupLabel>Modules</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{MODULES.map((mod) => {
									const Icon = mod.icon
									const href = `/${mod.slug}`
									const isActive = pathname === href

									return (
										<SidebarMenuItem key={mod.slug}>
											<SidebarMenuButton
												isActive={isActive}
												tooltip={mod.title}
												render={<TransitionLink href={href} aria-current={isActive ? "page" : undefined} />}
											>
												<Icon />
												<span>{mod.title}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									)
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</nav>
			</SidebarContent>
		</Sidebar>
	)
}
