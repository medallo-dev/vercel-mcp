export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type InteractionLogRow = {
  id: string;
  request_id: string;
  user_id: string | null;
  caller: string;
  jsonrpc_id: Json | null;
  jsonrpc_method: string;
  tool_name: string | null;
  parameters: Json | null;
  response: Json;
  outcome: "pending" | "success" | "error";
  http_status: number;
  duration_ms: number;
  session_id: string | null;
  calling_agent: string | null;
  mcp_protocol_version: string | null;
  created_at: string;
};

export type McpDatabase = {
  mcp: {
    Tables: {
      interaction_log: {
        Row: InteractionLogRow;
        Insert: {
          id?: string;
          request_id: string;
          user_id?: string | null;
          caller: string;
          jsonrpc_id?: Json | null;
          jsonrpc_method: string;
          tool_name?: string | null;
          parameters?: Json | null;
          response: Json;
          outcome: "pending" | "success" | "error";
          http_status: number;
          duration_ms: number;
          session_id?: string | null;
          calling_agent?: string | null;
          mcp_protocol_version?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          user_id?: string | null;
          caller?: string;
          jsonrpc_id?: Json | null;
          jsonrpc_method?: string;
          tool_name?: string | null;
          parameters?: Json | null;
          response?: Json;
          outcome?: "pending" | "success" | "error";
          http_status?: number;
          duration_ms?: number;
          session_id?: string | null;
          calling_agent?: string | null;
          mcp_protocol_version?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
