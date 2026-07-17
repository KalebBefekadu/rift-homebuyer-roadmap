"use client";

import { use } from "react";
import { RoadmapWorkspace } from "@/components/RoadmapWorkspace";

export default function EditRoadmapPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  return <RoadmapWorkspace clientId={clientId} />;
}
