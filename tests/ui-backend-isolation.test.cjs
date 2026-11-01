const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = process.cwd();
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : /\.tsx?$/.test(filename) ? [filename] : [];
  });
}

test('reachable UI permits only recorder and report SQLite while isolating server, sync, and AI secrets', () => {
  const pending = [path.join(root, 'src/app/_layout.tsx'), ...sourceFiles(path.join(root, 'src/app/(app)'))];
  const visited = new Set();
  while (pending.length) {
    const filename = pending.pop();
    if (visited.has(filename)) continue;
    visited.add(filename);
    const relative = path.relative(root, filename).replaceAll(path.sep, '/');
    assert.doesNotMatch(relative, /^src\/(?:server|lib\/sync|components\/(?:database|sync))\//, relative);
    if (relative.startsWith('src/db/')) assert.ok(['src/db/client.ts', 'src/db/schema.ts', 'src/db/ready.ts'].includes(relative), relative);
    const text = fs.readFileSync(filename, 'utf8');
    assert.doesNotMatch(text, /process\.env\.(?:GNANI_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY|CLERK_SECRET_KEY|DATABASE_URL|RAG_OPENAI_API_KEY|RAG_DATABASE_URL|RAG_CLERK_SECRET_KEY)\b/, `${relative}: server secret`);
    const tree = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, filename.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        assert.doesNotMatch(specifier, /^(?:@neondatabase\/|neo4j|.*sarvam)/i, `${relative}: ${specifier}`);
        let base;
        if (specifier.startsWith('@/')) base = path.join(root, 'src', specifier.slice(2));
        else if (specifier.startsWith('.')) base = path.resolve(path.dirname(filename), specifier);
        if (base) {
          for (const suffix of ['.ts', '.tsx', '.native.ts', '.native.tsx', '.web.ts', '.web.tsx', '/index.ts', '/index.tsx']) {
            if (fs.existsSync(base + suffix)) {
              const target = path.relative(root, base + suffix).replaceAll(path.sep, '/');
              if (target.startsWith('src/db/')) {
                const allowed = (['src/lib/offline-reports/checkpoints.ts', 'src/lib/recording/repository.ts', 'src/lib/reports/history.ts', 'src/lib/reports/cloud.ts', 'src/lib/embeddings/indexing.ts'].includes(relative) && ['src/db/ready.ts', 'src/db/schema.ts'].includes(target)) ||
                  (relative === 'src/db/ready.ts' && target === 'src/db/client.ts') ||
                  (relative === 'src/db/client.ts' && target === 'src/db/schema.ts');
                assert.ok(allowed, `${relative} must not import ${target}`);
              }
              pending.push(base + suffix);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert.ok(visited.size > 10, 'The isolation check must traverse the UI import graph.');
});
