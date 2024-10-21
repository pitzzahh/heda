import * as React from "react";

import { Sidebar, SidebarContent, SidebarRail } from "@/components/ui/sidebar";
import { NavStructure } from "@/components/sidebar-nav-list";
import SidebarFooter from "@/components/custom/sidebar/sidebar-footer";
import SidebarHeader from "@/components/custom/sidebar/sidebar-header";

export async function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader />
      <SidebarContent>
        <NavStructure />
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter />
    </Sidebar>
  );
}
