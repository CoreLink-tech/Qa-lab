// Loaded once via jest's `setupFiles`, before any test file runs.
//
// class-validator/class-transformer decorators (used in env.validation.ts
// and will be used in every request DTO going forward) rely on
// Reflect.getMetadata, which only exists once this polyfill is loaded.
// The full Nest app gets this for free as a side effect of Nest's own
// bootstrap process, but a plain unit test that imports a decorated
// class directly (without going through Nest's DI container) does not
// -- confirmed by env.validation.spec.ts failing with
// "TypeError: Reflect.getMetadata is not a function" before this file
// existed.
import 'reflect-metadata';
