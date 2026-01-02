import { EventEmitter } from 'events';

// A simple event emitter to decouple error handling from the data fetching logic.
// This allows us to throw errors from anywhere in the app and catch them
// in a centralized location (e.g., a React component) to display in the
// Next.js error overlay during development.
export const errorEmitter = new EventEmitter();
