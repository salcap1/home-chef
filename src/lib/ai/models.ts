import { getEnv } from "@/lib/env";

export function getConversationModel(): string {
  return getEnv().AI_MODEL;
}

export function getPlanningModel(): string {
  return getEnv().AI_PLANNING_MODEL;
}
