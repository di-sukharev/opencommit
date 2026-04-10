import { jest } from '@jest/globals';
import 'cli-testing-library/extend-expect';
import { configure } from 'cli-testing-library';

// Make Jest available globally
global.jest = jest;

/**
 * CLI rendering gets noticeably slower under coverage and on CI, so keep a
 * slightly roomier timeout than the library default.
 */
configure({ asyncUtilTimeout: 5000 });
