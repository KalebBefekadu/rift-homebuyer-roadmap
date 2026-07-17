import type {
  AgentBranding,
  CalcDefaults,
  ClientStage,
  RoadmapFormState,
  RoadmapOutputs,
  TimeToBuy,
} from "@/lib/roadmap/types";
import { DEFAULT_BRANDING, DEFAULT_CALC } from "@/lib/roadmap/constants";
import { computeRoadmap } from "@/lib/roadmap/calc";
import { formToCalcInputs } from "@/lib/roadmap/types";
import { SEED_DPA_PROGRAMS, type SeedDpaProgram } from "@/lib/roadmap/dpa-seed";

const STORAGE_KEY = "rift-roadmap-v1";

export interface StoredClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timeToBuy: TimeToBuy;
  stage: ClientStage;
  createdAt: string;
  updatedAt: string;
}

export interface StoredRoadmap {
  id: string;
  clientId: string;
  version: number;
  inputs: RoadmapFormState;
  outputs: RoadmapOutputs;
  createdAt: string;
}

export interface AppStore {
  branding: AgentBranding;
  calcDefaults: CalcDefaults;
  clients: StoredClient[];
  roadmaps: StoredRoadmap[];
  dpaPrograms: SeedDpaProgram[];
}

function uid(): string {
  return crypto.randomUUID();
}

function emptyStore(): AppStore {
  return {
    branding: { ...DEFAULT_BRANDING },
    calcDefaults: { ...DEFAULT_CALC },
    clients: [],
    roadmaps: [],
    dpaPrograms: SEED_DPA_PROGRAMS.map((p) => ({ ...p })),
  };
}

export function loadStore(): AppStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as AppStore;
    return {
      ...emptyStore(),
      ...parsed,
      branding: { ...DEFAULT_BRANDING, ...parsed.branding },
      calcDefaults: { ...DEFAULT_CALC, ...parsed.calcDefaults },
      dpaPrograms: parsed.dpaPrograms?.length ? parsed.dpaPrograms : emptyStore().dpaPrograms,
    };
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: AppStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listClients(): StoredClient[] {
  return loadStore().clients.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getClient(id: string): StoredClient | undefined {
  return loadStore().clients.find((c) => c.id === id);
}

export function getLatestRoadmap(clientId: string): StoredRoadmap | undefined {
  return loadStore()
    .roadmaps.filter((r) => r.clientId === clientId)
    .sort((a, b) => b.version - a.version)[0];
}

export function getBranding(): AgentBranding {
  return loadStore().branding;
}

export function getCalcDefaults(): CalcDefaults {
  return loadStore().calcDefaults;
}

export function getDpaPrograms(): SeedDpaProgram[] {
  return loadStore().dpaPrograms.filter((p) => p.active);
}

export function saveSettings(branding: AgentBranding, calcDefaults: CalcDefaults): void {
  const store = loadStore();
  store.branding = branding;
  store.calcDefaults = calcDefaults;
  saveStore(store);
}

export function updateClientMeta(
  id: string,
  patch: Partial<Pick<StoredClient, "stage" | "timeToBuy" | "email" | "phone">>,
): void {
  const store = loadStore();
  const client = store.clients.find((c) => c.id === id);
  if (!client) return;
  Object.assign(client, patch, { updatedAt: new Date().toISOString() });
  saveStore(store);
}

export function saveClientAndRoadmap(
  form: RoadmapFormState,
  existingClientId?: string,
): { clientId: string; roadmapId: string; version: number } {
  const store = loadStore();
  const now = new Date().toISOString();
  const outputs = computeRoadmap(formToCalcInputs(form));

  let client = existingClientId
    ? store.clients.find((c) => c.id === existingClientId)
    : undefined;

  if (!client) {
    client = {
      id: uid(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      timeToBuy: form.timeToBuy,
      stage: "roadmap_done",
      createdAt: now,
      updatedAt: now,
    };
    store.clients.push(client);
  } else {
    client.firstName = form.firstName.trim();
    client.lastName = form.lastName.trim();
    client.email = form.email.trim();
    client.phone = form.phone.trim();
    client.timeToBuy = form.timeToBuy;
    if (client.stage === "lead") client.stage = "roadmap_done";
    client.updatedAt = now;
  }

  const prior = store.roadmaps.filter((r) => r.clientId === client!.id);
  const version = prior.length ? Math.max(...prior.map((r) => r.version)) + 1 : 1;
  const roadmap: StoredRoadmap = {
    id: uid(),
    clientId: client.id,
    version,
    inputs: form,
    outputs,
    createdAt: now,
  };
  store.roadmaps.push(roadmap);
  saveStore(store);
  return { clientId: client.id, roadmapId: roadmap.id, version };
}
