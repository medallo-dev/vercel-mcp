CREATE SCHEMA IF NOT EXISTS mcp;

REVOKE ALL ON SCHEMA mcp FROM public;
GRANT USAGE ON SCHEMA mcp TO service_role;

CREATE TABLE mcp.interaction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  user_id uuid,
  caller text NOT NULL,
  jsonrpc_id jsonb,
  jsonrpc_method text NOT NULL,
  tool_name text,
  parameters jsonb,
  response jsonb NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('pending', 'success', 'error')),
  http_status integer NOT NULL,
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  session_id text,
  calling_agent text,
  mcp_protocol_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_interaction_log_user_created
  ON mcp.interaction_log (user_id, created_at DESC);

CREATE UNIQUE INDEX idx_mcp_interaction_log_request_id
  ON mcp.interaction_log (request_id);

CREATE INDEX idx_mcp_interaction_log_method_created
  ON mcp.interaction_log (jsonrpc_method, created_at DESC);

COMMENT ON SCHEMA mcp IS
  'MCP audit log: service_role INSERT/UPDATE/SELECT (SELECT required so UPDATE/WHERE can evaluate); no recruiter API.';

COMMENT ON TABLE mcp.interaction_log IS
  'MCP JSON-RPC audit rows: INSERT a pending row at request start then UPDATE with final envelope and timing. Keyed per HTTP request via request_id.';

ALTER TABLE mcp.interaction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp.interaction_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE mcp.interaction_log FROM public;
REVOKE ALL ON TABLE mcp.interaction_log FROM anon;
REVOKE ALL ON TABLE mcp.interaction_log FROM authenticated;

GRANT INSERT, SELECT, UPDATE ON TABLE mcp.interaction_log TO service_role;
