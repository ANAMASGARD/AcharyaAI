import { expect, it, vi } from 'vitest';
import { appendNativeRagFile } from '@/lib/rag-upload-file';
import { convertFormDataAsync } from '../../node_modules/expo/src/winter/fetch/convertFormData';

vi.mock('expo-file-system', () => ({ File: class {
  name = 'paper.pdf'; type = 'application/pdf';
  async bytes() { return new TextEncoder().encode('%PDF-fixture'); }
} }));

it('serializes a native picker attachment with the installed Expo fetch converter', async () => {
  // Native FormData preserves file objects. Exercise Expo's actual byte conversion.
  const parts: [string, unknown][] = [];
  const form = { append: (name: string, value: unknown) => parts.push([name, value]), entries: () => parts.values() } as unknown as FormData;
  appendNativeRagFile(form, { uri: 'file:///cache/paper.pdf', name: 'paper.pdf', mimeType: 'application/pdf' });
  const { body } = await convertFormDataAsync(form, 'test-boundary');
  const wire = new TextDecoder().decode(body);
  expect(wire).toContain('filename="paper.pdf"');
  expect(wire).toContain('content-type: application/pdf');
  expect(wire).toContain('%PDF-fixture');
});
