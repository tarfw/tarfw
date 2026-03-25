import { DurableObject } from 'cloudflare:workers';

export class ConversationDO extends DurableObject {
    async fetch(request: Request): Promise<Response> {
        // Simple stub for chat groups handling
        return new Response('Conversation DO active');
    }
}

// SessionDO is now implemented in session.ts
// Re-export for backwards compatibility
export { SessionDO } from './session';
