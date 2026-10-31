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

test('reachable product UI imports no production database, sync, or AI backend modules', () => {
  const pending = [path.join(root, 'src/app/_layout.tsx'), ...sourceFiles(path.join(root, 'src/app/(app)'))];
  const visited = new Set();
  while (pending.length) {
    const filename = pending.pop();
    if (visited.has(filename)) continue;
    visited.add(filename);
    const relative = path.relative(root, filename).replaceAll(path.sep, '/');
    assert.doesNotMatch(relative, /^src\/(?:server|db|lib\/sync|components\/(?:database|sync))\//, relative);
    const text = fs.readFileSync(filename, 'utf8');
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
            if (fs.existsSync(base + suffix)) pending.push(base + suffix);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert.ok(visited.size > 10, 'The isolation check must traverse the UI import graph.');
});
