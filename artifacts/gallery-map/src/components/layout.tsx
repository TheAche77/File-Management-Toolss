import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  List, 
  Settings,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 60000 }
  });

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/galleries", label: "Directory", icon: List },
    { href: "/map", label: "Map View", icon: MapIcon },
    { href: "/admin", label: "Admin", icon: Settings },
  ];

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex shrink-0">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-serif font-semibold text-primary">Gallerie d'Italia</h1>
          <p className="text-sm text-muted-foreground mt-1 uppercase tracking-widest text-[10px]">Roma</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} className="block">
                <div 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
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
        <header className="md:hidden p-4 border-b border-border bg-sidebar flex items-center justify-between shrink-0">
          <h1 className="text-xl font-serif font-semibold text-primary">Gallerie d'Italia</h1>
        </header>
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
