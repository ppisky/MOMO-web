import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const isDesktopPackage = (name) => /^(?:electron(?:-|$)|@electron\/|@electron-forge\/)/.test(name)

for (const file of ['../../package.json', 'package.json', 'packages/chatbox-core/package.json', 'packages/chatbox-react/package.json']) {
  const manifest = JSON.parse(readFileSync(resolve(root, file), 'utf8'))
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(manifest[key] ?? {})) {
      if (isDesktopPackage(name)) failures.push(`${file}: desktop dependency ${name}`)
    }
  }
  for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
    if (/electron|\.erb\/|release\/app/.test(command)) failures.push(`${file}: desktop script ${name}`)
  }
}

function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') scan(file)
    } else if (/\.[cm]?[jt]sx?$/.test(file)) {
      const source = readFileSync(file, 'utf8')
      // Tests can describe the forbidden API, but production code cannot call it.
      if (!/\.(test|spec|stories)\./.test(file) && /\b(?:window|globalThis)\.electronAPI\b/.test(source)) {
        failures.push(`${file}: native bridge call`)
      }
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
      function visit(node) {
        const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === 'require')
            ? node.arguments[0]
            : undefined
        if (specifier && ts.isStringLiteral(specifier) && (isDesktopPackage(specifier.text) || /(?:^|\/)src\/(main|preload)\//.test(specifier.text))) {
          failures.push(`${file}: desktop import ${specifier.text}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
  }
}
for (const directory of ['src', 'packages/chatbox-core/src', 'packages/chatbox-react/src']) scan(join(root, directory))

const lock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8')
// electron-to-chromium is Browserslist's version table, not an Electron runtime.
if (/^  (?:electron(?!-to-chromium@)(?:-|@)|'@electron\/|release\/app:)/m.test(lock)) {
  failures.push('pnpm-lock.yaml: Electron package or retired release workspace remains')
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Web boundary passed: no Electron dependency, startup script, native bridge or source import.')
}
