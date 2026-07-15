import { Outlet } from "react-router-dom";
import type { Sesion } from "@/data/authSupabase";
import { useBootstrapCuerposPoliciales } from "@/data/useCuerposPoliciales";
import { useBootstrapUnidadesSebin } from "@/data/useUnidadesSebin";
import { MapaCentrosProvider } from "@/contexts/MapaCentrosContext";
import { PathnameNavegacionProvider } from "@/contexts/PathnameNavegacionContext";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

interface Props {
  sesion: Sesion;
}

function AppShellInner({ sesion }: Props) {
  useBootstrapCuerposPoliciales();
  useBootstrapUnidadesSebin();

  return (
    <PathnameNavegacionProvider>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-[100dvh] w-full overflow-hidden">
          <Sidebar collapsible="icon" variant="sidebar">
            <AppSidebar sesion={sesion} />
            <SidebarRail />
          </Sidebar>

          <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <TopBar sesion={sesion} />
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <Outlet context={{ sesion }} />
            </div>
          </SidebarInset>
        </div>
      </TooltipProvider>
    </PathnameNavegacionProvider>
  );
}

/** Layout global con sidebar (rail o drawer según la vista). */
export function AppShell({ sesion }: Props) {
  return (
    <MapaCentrosProvider>
      <SidebarProvider defaultOpen={false}>
        <AppShellInner sesion={sesion} />
      </SidebarProvider>
    </MapaCentrosProvider>
  );
}
