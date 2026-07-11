import { Link } from "@tanstack/react-router";
import { ChefHat } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Planner" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-3 py-2">
        <div className="flex items-center gap-5">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <ChefHat className="size-4 text-emerald-500" />
            Cookbook Daily Planner
          </Link>
          <nav className="flex gap-3 text-sm text-muted-foreground">
            {links.map(({ to, label }) => {
              return (
                <Link
                  key={to}
                  to={to}
                  activeProps={{ className: "text-foreground" }}
                  className="transition-colors hover:text-foreground"
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
