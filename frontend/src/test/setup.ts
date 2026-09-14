import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom lacks pointer capture; the minimap calls these on every drag.
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;

afterEach(cleanup);
