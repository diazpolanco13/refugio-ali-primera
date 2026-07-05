import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import type { Sesion } from "@/data/authSupabase";
import { MapaCentrosProvider } from "@/contexts/MapaCentrosContext";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { tituloDeRuta } from "@/layouts/titulosPagina";
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
  const location = useLocation();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const titulo = tituloDeRuta(location.pathname);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-[100dvh] w-full overflow-hidden">
        <Sidebar collapsible="icon" variant="sidebar">
          <AppSidebar sesion={sesion} />
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            sesion={sesion}
            titulo={titulo}
            online={online}
          />
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <Outlet context={{ sesion }} />
          </div>
        </SidebarInset>
      </div>
    </TooltipProvider>
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
