// src/local-server/api-store.ts
import type { ApprovalRequest, InsertPayload, DataStore } from '../shared/types';

/**
 * DataStore implementation that delegates to a user's remote API.
 *
 * The remote API must implement:
 *   POST   /requests              — body: InsertPayload JSON → 201 (must reject duplicate IDs with 409)
 *   GET    /requests/:id          — → ApprovalRequest JSON (or 404)
 *   GET    /requests/:id/status   — → { status: string } (or 404)
 *   POST   /requests/:id/resolve  — body: { status, resolvedBy } → { updated: boolean }
 *                                   (must only resolve requests with status 'pending')
 *   GET    /requests?limit=N      — → ApprovalRequest[] JSON
 */
export class ApiStore implements DataStore {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  async insertRequest(req: InsertPayload): Promise<void> {
    const res = await fetch(`${this.baseUrl}/requests`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      throw new Error(`ApiStore: POST /requests failed (${res.status}): ${await res.text()}`);
    }
  }

  async getRequest(id: string): Promise<ApprovalRequest | null> {
    const res = await fetch(`${this.baseUrl}/requests/${id}`, {
      headers: this.headers,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`ApiStore: GET /requests/${id} failed (${res.status})`);
    }
    return (await res.json()) as ApprovalRequest;
  }

  async getRequestStatus(id: string): Promise<ApprovalRequest['status'] | null> {
    const res = await fetch(`${this.baseUrl}/requests/${id}/status`, {
      headers: this.headers,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`ApiStore: GET /requests/${id}/status failed (${res.status})`);
    }
    const body = (await res.json()) as { status: string };
    return body.status as ApprovalRequest['status'];
  }

  async resolveRequest(
    id: string,
    status: 'approved' | 'denied',
    resolvedBy: string,
  ): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/requests/${id}/resolve`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ status, resolvedBy }),
    });
    if (!res.ok) {
      throw new Error(`ApiStore: POST /requests/${id}/resolve failed (${res.status})`);
    }
    const body = (await res.json()) as { updated: boolean };
    return body.updated;
  }

  async updateDescription(id: string, description: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/requests/${id}/description`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ description }),
    });
    if (!res.ok) {
      throw new Error(`ApiStore: POST /requests/${id}/description failed (${res.status})`);
    }
  }

  async listRequests(limit = 50): Promise<ApprovalRequest[]> {
    const res = await fetch(`${this.baseUrl}/requests?limit=${limit}`, {
      headers: this.headers,
    });
    if (!res.ok) {
      throw new Error(`ApiStore: GET /requests failed (${res.status})`);
    }
    return (await res.json()) as ApprovalRequest[];
  }
}
