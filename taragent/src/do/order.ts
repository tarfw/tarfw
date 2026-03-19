import { DurableObject } from 'cloudflare:workers';

export class OrderDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      if (request.method === "POST") {
        const payload = await request.text();
        const sockets = this.ctx.getWebSockets();
        for (const ws of sockets) {
          try {
            ws.send(payload);
          } catch (e) {
            console.error("Failed to broadcast to session:", e);
          }
        }
        return new Response("Broadcast successful", { status: 200 });
      }
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection explicitly through context
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    console.log(`OrderDO received message: ${message}`);
    const sockets = this.ctx.getWebSockets();
    for (const session of sockets) {
      if (session !== ws) {
        try {
          session.send(message);
        } catch (e) {
          console.error("Failed to send message to session:", e);
        }
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {}

  webSocketError(ws: WebSocket, error: unknown) {}
}
