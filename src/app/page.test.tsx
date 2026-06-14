import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import HomePage from "./page"
import { MODULES } from "@/config/modules"

describe("HomePage", () => {
	it("root element is NOT a <main> — layout owns the single main landmark (REQ-A11Y-2)", () => {
		// The layout.tsx already wraps all pages in a <main>. If page.tsx also renders
		// a <main>, it creates a duplicate landmark. The outermost wrapper must be a
		// non-landmark element (<div> or <section>).
		const { container } = render(<HomePage />)
		// The component tree rendered by HomePage must not contain a <main> element
		const mainElements = container.querySelectorAll("main")
		expect(mainElements.length).toBe(0)
	})
	it("renders the application intro heading", () => {
		render(<HomePage />)
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"Algorithm Systems Playground"
		)
	})

	it("renders a link for each of the 4 modules", () => {
		render(<HomePage />)

		const expectedSlugs = MODULES.map((m) => m.slug)
		for (const slug of expectedSlugs) {
			const link = screen.getByRole("link", { name: new RegExp(`Open ${slug}`, "i") })
			expect(link).toBeInTheDocument()
			expect(link).toHaveAttribute("href", `/${slug}`)
		}
	})

	it("renders a link to /pathfinding", () => {
		render(<HomePage />)
		expect(screen.getByRole("link", { name: /open pathfinding/i })).toBeInTheDocument()
	})

	it("renders a link to /graphs", () => {
		render(<HomePage />)
		expect(screen.getByRole("link", { name: /open graphs/i })).toBeInTheDocument()
	})

	it("renders a link to /simulation", () => {
		render(<HomePage />)
		expect(screen.getByRole("link", { name: /open simulation/i })).toBeInTheDocument()
	})

	it("renders a link to /dashboard", () => {
		render(<HomePage />)
		expect(screen.getByRole("link", { name: /open dashboard/i })).toBeInTheDocument()
	})
})
