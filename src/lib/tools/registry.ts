import { webSearchTool } from "./webSearch";
import { gmailSendTool } from "./gmailSend";
import { calCreateTool } from "./calCreate";
import type { ToolDefinition } from "./types";

/**
 * Every AI tool available to the platform. To add a new one:
 *   1. Implement `ToolDefinition<Input, Output>` in its own file under lib/tools/.
 *   2. Add it to this array.
 * Nothing else in the app needs to know about specific tools — the registry
 * is the single seam for extending the agent's capabilities.
 */
export const toolRegistry: ToolDefinition<unknown, unknown>[] = [
  webSearchTool,
  gmailSendTool,
  calCreateTool,
] as unknown as ToolDefinition<unknown, unknown>[];

export function listTools() {
  return toolRegistry.map(({ name, description }) => ({ name, description }));
}

export { webSearchTool, gmailSendTool, calCreateTool };
