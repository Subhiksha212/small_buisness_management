/**
 * Server-Sent Events (SSE) Real-Time Notification Service
 * Enforces strict per-user channel isolation: User A NEVER receives User B's events!
 * Transmits real-time events: payment.success, sale.created, expense.created, inventory.updated.
 */

class SSEService {
  constructor() {
    // Map of userId (string) -> Set of active Express Response objects
    this.userClients = new Map();

    // Heartbeat every 25 seconds to keep HTTP connections alive through proxies and browsers
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 25000);
  }

  /**
   * Registers an authenticated user's SSE client connection
   */
  addClient(userId, res, req) {
    const userKey = String(userId);

    // Set standard SSE response headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disables proxy buffering (Nginx/Cloudflare)
    });

    // Flush headers immediately if supported
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    // Initial greeting / handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    if (!this.userClients.has(userKey)) {
      this.userClients.set(userKey, new Set());
    }
    this.userClients.get(userKey).add(res);

    // Clean up when client disconnects
    req.on('close', () => {
      this.removeClient(userKey, res);
    });

    req.on('error', () => {
      this.removeClient(userKey, res);
    });
  }

  /**
   * Removes client on connection termination
   */
  removeClient(userKey, res) {
    if (this.userClients.has(userKey)) {
      const clientSet = this.userClients.get(userKey);
      clientSet.delete(res);
      if (clientSet.size === 0) {
        this.userClients.delete(userKey);
      }
    }
  }

  /**
   * Emits an event strictly to the authenticated user's active SSE connections.
   * Sensitive data (tokens, secrets, card CVV) must NEVER be passed to this method.
   */
  emitToUser(userId, eventType, data = {}) {
    if (!userId) return;
    const userKey = String(userId);
    const clientSet = this.userClients.get(userKey);

    if (!clientSet || clientSet.size === 0) {
      return; // User has no open tabs right now; MongoDB holds source of truth
    }

    // Sanitize payload: strip any accidental secrets
    const sanitized = {
      ...data,
      timestamp: new Date().toISOString(),
    };
    delete sanitized.secret;
    delete sanitized.token;
    delete sanitized.webhookSecret;
    delete sanitized.passwordHash;

    const message = `event: ${eventType}\ndata: ${JSON.stringify(sanitized)}\n\n`;

    for (const res of clientSet) {
      try {
        res.write(message);
      } catch (err) {
        this.removeClient(userKey, res);
      }
    }
  }

  /**
   * Broadcasts an event to all actively connected clients
   */
  broadcast(eventType, data = {}) {
    const sanitized = {
      ...data,
      timestamp: new Date().toISOString(),
    };
    delete sanitized.secret;
    delete sanitized.token;
    delete sanitized.webhookSecret;
    delete sanitized.passwordHash;

    const message = `event: ${eventType}\ndata: ${JSON.stringify(sanitized)}\n\n`;

    for (const [userKey, clientSet] of this.userClients.entries()) {
      for (const res of clientSet) {
        try {
          res.write(message);
        } catch (err) {
          this.removeClient(userKey, res);
        }
      }
    }
  }

  /**
   * Sends comment ping to keep sockets alive without triggering frontend message events
   */
  sendHeartbeat() {
    for (const [userKey, clientSet] of this.userClients.entries()) {
      for (const res of clientSet) {
        try {
          res.write(': ping\n\n');
        } catch (err) {
          this.removeClient(userKey, res);
        }
      }
    }
  }
}

export const sseService = new SSEService();
export default sseService;
