import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const webSourceRoot = path.resolve(__dirname, '../../apps/web/src');
const nativeCalendarType = /type\s*=\s*["'](?:date|datetime-local|month|week)["']/g;

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

test('all calendar fields use the Jalali UI components', () => {
  const violations = sourceFiles(webSourceRoot).flatMap(filePath => {
    const source = fs.readFileSync(filePath, 'utf8');
    return Array.from(source.matchAll(nativeCalendarType), match => ({
      file: path.relative(webSourceRoot, filePath),
      inputType: match[0],
    }));
  });

  expect(violations, 'Native Gregorian calendar inputs must be replaced with JalaliDateField/JalaliDateTimePicker.').toEqual([]);
});
