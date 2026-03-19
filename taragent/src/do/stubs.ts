import { DurableObject } from 'cloudflare:workers';

export class ConversationDO extends DurableObject {
    async fetch(request: Request): Promise<Response> {
        // Simple stub for chat groups handling
        return new Response('Conversation DO active');
    }
}

export class SessionDO extends DurableObject {
    async fetch(request: Request): Promise<Response> {
        // Simple stub for frontend user session handling
        return new Response('Session DO active');
    }
}
