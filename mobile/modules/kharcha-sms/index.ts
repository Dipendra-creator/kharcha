// Re-export the native module. On web, it will be resolved to KharchaSmsModule.web.ts
// and on native platforms to KharchaSmsModule.ts
export { default } from './src/KharchaSmsModule';
export * from './src/KharchaSms.types';
