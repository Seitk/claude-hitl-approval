// src/shared/types.ts

export interface HitlRule {
  tool: string;
  pattern: string;
}

export interface DataSourceConfig {
  type: 'sqlite' | 'api';
  /** SQLite database path (only for type: 'sqlite'). Defaults to ~/.hitl/hitl.db */
  dbPath?: string;
  /** Base URL of the remote API (only for type: 'api') */
  url?: string;
  /** Extra headers sent with every request to the remote API */
  headers?: Record<string, string>;
}

export interface HitlConfig {
  approval: {
    url: string;
    pollIntervalMs: number;
    timeoutMs: number;
  };
  rules: HitlRule[];
  dataSource?: DataSourceConfig;
}

export interface ApprovalRequest {
  id: string;
  tool: string;
  command: string;
  description: string | null;
  workdir: string;
  sessionId: string | null;
  userId: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
}

export type InsertPayload = Omit<ApprovalRequest, 'status' | 'resolvedAt' | 'resolvedBy'>;

export interface DataStore {
  insertRequest(req: InsertPayload): Promise<void>;
  getRequest(id: string): Promise<ApprovalRequest | null>;
  getRequestStatus(id: string): Promise<ApprovalRequest['status'] | null>;
  resolveRequest(id: string, status: 'approved' | 'denied', resolvedBy: string): Promise<boolean>;
  updateDescription(id: string, description: string): Promise<void>;
  listRequests(limit?: number): Promise<ApprovalRequest[]>;
}

export interface HookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
  session_id?: string;
  workspace?: { current_dir?: string };
}

export interface CreateRequestBody {
  tool: string;
  command: string;
  workdir: string;
  sessionId?: string;
}

export interface AuthService {
  generateToken(requestId: string): string;
  validateToken(token: string, requestId: string): { valid: boolean; error?: string };
}
