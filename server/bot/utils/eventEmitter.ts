// Import EventEmitter from Node.js
import { EventEmitter as NodeEventEmitter } from 'events';
import { logger } from './logger';

// Create enum for event types
export enum QUEUE_EVENTS {
  UPDATED = 'queue:updated',
  PLAYER_JOINED = 'queue:player_joined',
  PLAYER_LEFT = 'queue:player_left',
}

export enum MATCH_EVENTS {
  CREATED = 'match:created',
  UPDATED = 'match:updated',
  ENDED = 'match:ended',
}

// Singleton EventEmitter class
export class EventEmitter {
  private static instance: EventEmitter | null = null;
  private emitter: NodeEventEmitter;

  private constructor() {
    this.emitter = new NodeEventEmitter();
    // Set higher limit for listeners to avoid warning
    this.emitter.setMaxListeners(50);
  }

  public static getInstance(): EventEmitter {
    if (!EventEmitter.instance) {
      EventEmitter.instance = new EventEmitter();
      logger.info('EventEmitter initialized as singleton instance');
    }
    return EventEmitter.instance;
  }

  public emit(eventName: string, ...args: any[]): boolean {
    try {
      const listenerCount = this.emitter.listenerCount(eventName);
      logger.info(`Emitting event: ${eventName} to ${listenerCount} listeners`);
      
      if (listenerCount === 0) {
        logger.warn(`Warning: No listeners registered for event "${eventName}"`);
      }
      
      return this.emitter.emit(eventName, ...args);
    } catch (error) {
      logger.error(`Error emitting event ${eventName}: ${error}`);
      return false;
    }
  }

  public on(eventName: string, listener: (...args: any[]) => void): NodeEventEmitter {
    const wrappedListener = (...args: any[]) => {
      try {
        return listener(...args);
      } catch (error) {
        logger.error(`Error in event listener for ${eventName}: ${error}`);
      }
    };
    return this.emitter.on(eventName, wrappedListener);
  }

  public off(eventName: string, listener: (...args: any[]) => void): NodeEventEmitter {
    return this.emitter.off(eventName, listener);
  }

  public once(eventName: string, listener: (...args: any[]) => void): NodeEventEmitter {
    const wrappedListener = (...args: any[]) => {
      try {
        return listener(...args);
      } catch (error) {
        logger.error(`Error in once event listener for ${eventName}: ${error}`);
      }
    };
    return this.emitter.once(eventName, wrappedListener);
  }

  public removeAllListeners(eventName?: string): NodeEventEmitter {
    return this.emitter.removeAllListeners(eventName);
  }

  public listenerCount(eventName: string): number {
    return this.emitter.listenerCount(eventName);
  }
}