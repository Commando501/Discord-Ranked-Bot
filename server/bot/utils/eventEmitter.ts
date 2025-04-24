import { EventEmitter } from 'events';
import { logger } from './logger'; // Assuming a logger is available

// Create a singleton EventEmitter for global application events
class GlobalEventEmitter extends EventEmitter {
  private static instance: GlobalEventEmitter;

  private constructor() {
    super();
    // Increase max listeners to avoid warnings
    this.setMaxListeners(20);
  }

  public static getInstance(): GlobalEventEmitter {
    if (!GlobalEventEmitter.instance) {
      GlobalEventEmitter.instance = new GlobalEventEmitter();
    }
    return GlobalEventEmitter.instance;
  }

  public emit(event: string, ...args: any[]): boolean {
    logger.debug(`[EventEmitter] Emitting event: ${event}`);
    
    // Adding a try/catch around the emit to ensure robustness
    try {
      return super.emit(event, ...args);
    } catch (error) {
      logger.error(`[EventEmitter] Error emitting event ${event}: ${error}`);
      return false;
    }
  }
  
  /**
   * Enhanced version of on that includes error handling
   */
  public on(event: string, listener: (...args: any[]) => void): this {
    const wrappedListener = (...args: any[]) => {
      try {
        listener(...args);
      } catch (error) {
        logger.error(`[EventEmitter] Error in listener for event ${event}: ${error}`);
      }
    };
    
    return super.on(event, wrappedListener);
  }
}

// Export standard events names to avoid typos
export const QUEUE_EVENTS = {
  UPDATED: 'queue:updated',
  PLAYER_JOINED: 'queue:player_joined',
  PLAYER_LEFT: 'queue:player_left',
  BUTTON_INTERACTION: 'queue:button_interaction',
};

export const MATCH_EVENTS = {
  CREATED: 'match:created',
  UPDATED: 'match:updated',
  ENDED: 'match:ended',
  BUTTON_INTERACTION: 'match:button_interaction',
};

// Export the singleton instance getter
export { GlobalEventEmitter as EventEmitter };