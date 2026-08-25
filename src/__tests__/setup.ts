/**
 * Shared Vitest setup for component (jsdom) tests.
 *
 * Component test files include a `// @vitest-environment jsdom` pragma and
 * import this module. It registers the jest-dom matchers and exposes React on
 * the global scope so that source components compiled with the classic JSX
 * runtime (`React.createElement`) resolve correctly under esbuild.
 */
import "@testing-library/jest-dom/vitest";
import React from "react";

// Make React resolvable as a global for components that rely on the automatic
// JSX runtime under Next.js / SWC but are transpiled by esbuild in tests.
(globalThis as unknown as { React: typeof React }).React = React;
