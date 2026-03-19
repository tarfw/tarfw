import { DurableObject } from 'cloudflare:workers';

export class TaskDO extends DurableObject {
  /**
   * The fetch handler here can be used to set or check alarms manually.
   * e.g. POST /schedule to set an alarm
   */
  async fetch(request: Request): Promise<Response> {
      console.log(`TaskDO fetch received: ${request.method} ${request.url}`);
      try {
          const body: any = await request.json();
          console.log(`TaskDO body: ${JSON.stringify(body)}`);
          if (body.action === 'schedule') {
             // Set an alarm for 'delayMs' milliseconds in the future
             const delayMs = body.delayMs || 60000; // default 1 min
             await this.ctx.storage.setAlarm(Date.now() + delayMs);
             console.log(`TaskDO alarm successfully set for ${delayMs}ms from now.`);
             return new Response(`Alarm scheduled in ${delayMs}ms`);
          }
          return new Response("Unknown task DO action", { status: 400 });
      } catch (e: any) {
          return new Response(e.message, { status: 500 });
      }
  }

  /**
   * The alarm handler is triggered when the storage alarm fires.
   * This acts as our scheduler.
   */
  async alarm(): Promise<void> {
    console.log("TaskDO alarm triggered! Executing background job...");
    
    // In a real implementation we would fetch the Analytics Agent here
    // or trigger a webhook. For now we simulate the scheduling completion.
    
    // E.g.
    // const analytics = new AnalyticsAgent(db);
    // await analytics.generateDailyReport("shop:ramstore");
    
    console.log("Analytics report simulated.");
  }
}
