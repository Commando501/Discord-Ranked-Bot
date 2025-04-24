import { EventEmitter as NodeEventEmitter } from 'events';
import { logger } from './logger';

// Event constants
export const QUEUE_EVENTS = {
  UPDATED: 'queue:updated',
  PLAYER_JOINED: 'queue:player_joined',
  PLAYER_LEFT: 'queue:player_left'
};

export const MATCH_EVENTS = {
  CREATED: 'match:created',
  UPDATED: 'match:updated',
  ENDED: 'match:ended'
};

// Singleton event emitter to use across the application
export class EventEmitter {
  private static instance: EventEmitter | null = null;
  private emitter: NodeEventEmitter;
  private initialized: boolean = false;
  private pendingEvents: Array<{event: string, args: any[]}> = [];

  private constructor() {
    this.emitter = new NodeEventEmitter();
    // Increase max listeners to avoid memory leak warnings
    this.emitter.setMaxListeners(50);
    logger.info('EventEmitter initialized');

    // Add error handler for the event emitter
    this.emitter.on('error', (error) => {
      logger.error(`EventEmitter error: ${error}`);
    });
  }

  public static getInstance(): EventEmitter {
    if (!EventEmitter.instance) {
      EventEmitter.instance = new EventEmitter();
    }
    return EventEmitter.instance;
  }

  public on(event: string, listener: (...args: any[]) => void): void {
    try {
      // Wrap the listener in a try-catch to prevent errors from bubbling up
      const wrappedListener = (...args: any[]) => {
        try {
          listener(...args);
        } catch (error) {
          logger.error(`Error in event listener for "${event}": ${error}`);
        }
      };

      this.emitter.on(event, wrappedListener);
      logger.info(`Event listener registered for "${event}". Total listeners: ${this.emitter.listenerCount(event)}`);

      // Mark as initialized when first listener is added
      if (!this.initialized) {
        this.initialized = true;
        // Process any pending events
        this.processPendingEvents();
      }
    } catch (error) {
      logger.error(`Error registering event listener for "${event}": ${error}`);
    }
  }

  public once(event: string, listener: (...args: any[]) => void): void {
    try {
      // Wrap the listener in a try-catch to prevent errors from bubbling up
      const wrappedListener = (...args: any[]) => {
        try {
          listener(...args);
        } catch (error) {
          logger.error(`Error in one-time event listener for "${event}": ${error}`);
        }
      };

      this.emitter.once(event, wrappedListener);
      logger.info(`One-time event listener registered for "${event}". Total listeners: ${this.emitter.listenerCount(event)}`);
    } catch (error) {
      logger.error(`Error registering one-time event listener for "${event}": ${error}`);
    }
  }

  public emit(event: string, ...args: any[]): void {
    try {
      const listenerCount = this.emitter.listenerCount(event);

      if (listenerCount === 0) {
        if (!this.initialized) {
          // Store event for later processing if not initialized yet
          this.pendingEvents.push({event, args});
          logger.info(`Storing event "${event}" for later processing as system is not fully initialized`);
          return;
        }
        logger.warn(`Warning: No listeners registered for event "${event}"`);
      }

      logger.info(`Emitting event: ${event} to ${listenerCount} listeners`);
      this.emitter.emit(event, ...args);
    } catch (error) {
      logger.error(`Error emitting event "${event}": ${error}`);
    }
  }

  private processPendingEvents(): void {
    logger.info(`Processing ${this.pendingEvents.length} pending events`);

    // Process all pending events
    for (const {event, args} of this.pendingEvents) {
      try {
        logger.info(`Processing pending event: ${event}`);
        this.emitter.emit(event, ...args);
      } catch (error) {
        logger.error(`Error processing pending event "${event}": ${error}`);
      }
    }

    // Clear pending events
    this.pendingEvents = [];
  }

  public removeListener(event: string, listener: (...args: any[]) => void): void {
    try {
      this.emitter.removeListener(event, listener);
      logger.info(`Event listener removed for "${event}". Remaining listeners: ${this.emitter.listenerCount(event)}`);
    } catch (error) {
      logger.error(`Error removing event listener for "${event}": ${error}`);
    }
  }

  public removeAllListeners(event?: string): void {
    try {
      if (event) {
        this.emitter.removeAllListeners(event);
        logger.info(`All event listeners removed for "${event}"`);
      } else {
        this.emitter.removeAllListeners();
        logger.info(`All event listeners removed`);
      }
    } catch (error) {
      logger.error(`Error removing all event listeners: ${error}`);
    }
  }

  public listenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }
}