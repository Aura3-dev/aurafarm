import { useCallback, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route, Outlet } from "react-router"
import { MoonIcon, SunIcon } from "lucide-react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { SchemaSidebar } from "@/components/schema-sidebar"
import { SchemaPage } from "@/pages/schema-page"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

function DarkModeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  )

  const toggle = useCallback(() => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }, [dark])

  useEffect(() => {
    const saved = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const shouldBeDark = saved ? saved === "dark" : prefersDark
    setDark(shouldBeDark)
    document.documentElement.classList.toggle("dark", shouldBeDark)
  }, [])

  return (
    <Button variant="ghost" size="icon" className="size-8" onClick={toggle}>
      {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  )
}

function Layout() {
  return (
    <SidebarProvider>
      <SchemaSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
          <SidebarTrigger />
          <div className="ml-auto">
            <DarkModeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  )
}

function HomePage() {
  return (
    <div className="p-6">
      <p className="text-muted-foreground">Select a schema to explore.</p>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="schema/:name" element={<SchemaPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
