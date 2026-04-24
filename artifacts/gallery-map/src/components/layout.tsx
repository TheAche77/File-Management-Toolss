import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  List, 
  Settings,
  Activity,
  Compass,
  Menu,
  KanbanSquare,
  SearchCode,
  BriefcaseBusiness,
  BadgeCheck,
  Network,
  Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 60000 }
  });

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/research", label: "Research", icon: SearchCode },
    { href: "/offers", label: "Offers", icon: BriefcaseBusiness },
    { href: "/proof", label: "Proof", icon: Library },
    { href: "/accounts", label: "Accounts", icon: BadgeCheck },
    { href: "/relationships", label: "Relationships", icon: Network },
    { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
    { href: "/businesses", label: "Directory", icon: List },
    { href: "/map", label: "Map", icon: MapIcon },
    { href: "/admin", label: "Admin", icon: Settings },
  ];

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        const Icon = item.icon;
        
        return (
          <Link key={item.href} href={item.href} className="block">
            <div 
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded-md",
                isActive 
                  ? "bg-primary text-primary-foreground font-medium" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </div>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <aside className="w-64 border-r border-border bg-sidebar flex-col hidden md:flex shrink-0">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-serif font-semibold text-primary">Street Level Discovery</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest text-[10px]">Discovery & Outreach CRM</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>
        
        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5" />
            <span>API Status:</span>
            <span className={cn("flex items-center gap-1.5 font-medium", health?.status === 'ok' ? 'text-green-600' : 'text-yellow-600')}>
              <span className={cn("w-1.5 h-1.5 rounded-full", health?.status === 'ok' ? 'bg-green-600' : 'bg-yellow-600')} />
              {health?.status === 'ok' ? 'Online' : 'Checking...'}
            </span>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <header className="md:hidden h-14 border-b border-border bg-sidebar flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <span className="font-serif text-lg font-semibold text-primary">Street Level Discovery</span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-2">
                  <Compass className="h-6 w-6 text-primary" />
                  <span className="font-serif text-xl font-semibold tracking-tight text-primary">
                    Street Level Discovery
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-1">
                <NavLinks />
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-muted/20">
          {children}
        </div>
      </main>
    </div>
  );
}
