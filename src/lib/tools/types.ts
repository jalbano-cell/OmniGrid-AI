/**
 * Shared contract for every AI-callable tool (web_search, gmail_send,
 * cal_create, ...). Adding a new tool later means: implement this
 * interface, then register it in `registry.ts` — nothing else in the
 * app needs to change.
 */
export interface ToolResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ToolDefinition<Input, Output> {
  name: string;
  description: string;
  execute: (input: Input) => Promise<ToolResult<Output>>;
}
