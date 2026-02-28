import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import { DatabaseIcon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

async function fetchSchemas(): Promise<string[]> {
  const res = await fetch("/api/schemas")
  if (!res.ok) throw new Error("Failed to fetch schemas")
  return res.json()
}

export function SchemaSidebar() {
  const { name: activeSchema } = useParams<{ name: string }>()

  const { data: schemas, isLoading, error } = useQuery({
    queryKey: ["schemas"],
    queryFn: fetchSchemas,
  })

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80">
          <img src="/logo.svg" alt="AuraFarm" className="size-8 rounded" />
          <span className="text-lg font-semibold">AuraFarm</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Schemas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuButton disabled>
                      <Skeleton className="h-4 w-full" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              {error && (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-destructive text-sm">
                      Failed to load schemas
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {schemas?.map((schema) => (
                <SidebarMenuItem key={schema}>
                  <SidebarMenuButton asChild isActive={schema === activeSchema}>
                    <Link to={`/schema/${encodeURIComponent(schema)}`}>
                      <DatabaseIcon className="size-4" />
                      <span>{schema}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
