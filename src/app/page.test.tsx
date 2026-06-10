import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import HomePage from "./page"
import { MODULES } from "@/config/modules"

describe("HomePage", () => {
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
