import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BottomTabBar from "@/components/BottomTabBar";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("BottomTabBar", () => {
  it("renders all 5 tabs", () => {
    mockPathname = "/";
    render(<BottomTabBar />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Spielen")).toBeInTheDocument();
    expect(screen.getByText("Hinzufügen")).toBeInTheDocument();
    expect(screen.getByText("Profil")).toBeInTheDocument();
    expect(screen.getByText("Mehr")).toBeInTheDocument();
  });

  it("highlights the active tab", () => {
    mockPathname = "/today";
    render(<BottomTabBar />);

    const spielenLink = screen.getByText("Spielen").closest("a");
    expect(spielenLink?.className).toContain("text-forest");

    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink?.className).toContain("text-warm-400");
  });

  it("highlights Home tab on root path", () => {
    mockPathname = "/";
    render(<BottomTabBar />);

    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink?.className).toContain("text-forest");
  });

  it("does not render on /game detail page", () => {
    mockPathname = "/game";
    render(<BottomTabBar />);

    expect(screen.queryByTestId("bottom-tab-bar")).not.toBeInTheDocument();
  });

  it("does not render on /game/edit page", () => {
    mockPathname = "/game/edit";
    render(<BottomTabBar />);

    expect(screen.queryByTestId("bottom-tab-bar")).not.toBeInTheDocument();
  });

  it("does not render on /game/history page", () => {
    mockPathname = "/game/history";
    render(<BottomTabBar />);

    expect(screen.queryByTestId("bottom-tab-bar")).not.toBeInTheDocument();
  });

  it("renders the FAB-style add button with larger size", () => {
    mockPathname = "/";
    render(<BottomTabBar />);

    const addLink = screen.getByText("Hinzufügen").closest("a");
    expect(addLink?.className).toContain("-mt-4");

    const fabCircle = addLink?.querySelector("span");
    expect(fabCircle?.className).toContain("h-12");
    expect(fabCircle?.className).toContain("w-12");
  });

  it("links to correct routes", () => {
    mockPathname = "/";
    render(<BottomTabBar />);

    expect(screen.getByText("Home").closest("a")?.getAttribute("href")).toBe("/");
    expect(screen.getByText("Spielen").closest("a")?.getAttribute("href")).toBe("/today");
    expect(screen.getByText("Hinzufügen").closest("a")?.getAttribute("href")).toBe("/add");
    expect(screen.getByText("Profil").closest("a")?.getAttribute("href")).toBe("/achievements");
    expect(screen.getByText("Mehr").closest("a")?.getAttribute("href")).toBe("/settings");
  });
});
