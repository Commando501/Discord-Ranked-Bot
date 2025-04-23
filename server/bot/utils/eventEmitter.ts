
import { EventEmitter } from 'events';

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
}

// Export the singleton instance getter
module.exports = {
  EventEmitter: GlobalEventEmitter,
  QUEUE_EVENTS,
  MATCH_EVENTS
};

// Export standard events names to avoid typos
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
