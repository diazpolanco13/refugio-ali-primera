import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import type { Sesion } from "@/data/authSupabase";
import { MapaCentrosProvider, useMapaCentros } from "@/contexts/MapaCentrosContext";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { tituloDeRuta } from "@/layouts/titulosPagina";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";

interface Props {
  sesion: Sesion;
}

function AppShellInner({ sesion }: Props) {
  const location = useLocation();
  const isMapView = location.pathname === "/centros/mapa";
  const { menuDrawerOpen, setMenuDrawerOpen } = useMapaCentros();
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
  const ocultarTopBar = location.pathname.startsWith("/centro/");

  return (
    <TooltipProvider delayDuration={200}>
      {isMapView && (
        <Sheet open={menuDrawerOpen} onOpenChange={setMenuDrawerOpen}>
          <SheetContent
            side="left"
            className="w-[min(18rem,86vw)] gap-0 p-0"
            showCloseButton
          >
            <AppSidebar
              sesion={sesion}
              modoDrawer
              onNavigate={() => setMenuDrawerOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex h-[100dvh] w-full overflow-hidden">
        {!isMapView && (
          <Sidebar collapsible="icon" variant="sidebar">
            <AppSidebar sesion={sesion} />
            <SidebarRail />
          </Sidebar>
        )}

        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!ocultarTopBar && (
            <TopBar
              sesion={sesion}
              titulo={titulo}
              ocultarTriggerSidebar={isMapView}
              online={online}
            />
          )}
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
