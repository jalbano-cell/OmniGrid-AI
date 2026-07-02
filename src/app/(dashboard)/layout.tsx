import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { CommandPaletteProvider } from "@/components/layout/command-palette-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="md:pl-60 flex flex-col min-h-screen">
          <TopBar />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-[1600px] w-full mx-auto">{children}</main>
        </div>
      </div>
      <CommandPalette />
    </CommandPaletteProvider>
  );
}
