// Test-only conveniences: on-screen sign-in codes, test cards, simulated driving.
// On in local development, or on a deployed test site when DEMO_MODE=1. Never set DEMO_MODE on a real launch.
export const demoMode = () => process.env.DEMO_MODE === "1";
export const testTools = () => process.env.NODE_ENV !== "production" || demoMode();
