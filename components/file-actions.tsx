"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export function FileActions() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col gap-4">
        <Link href="/dashboard">
          <Button className="w-full">New File</Button>
        </Link>
        <Button variant="ghost" className="w-full">
          Load File
        </Button>
      </div>
    </div>
  );
}
