/**
 * deploy.mjs — Copies plugin artifacts to your local Obsidian vault.
 *
 * Usage:
 *   Set OBSIDIAN_VAULT_PLUGINS_PATH in your environment to the full path of
 *   the plugin folder inside your vault, then run:
 *
 *     npm run deploy
 *
 * Example (PowerShell):
 *   $env:OBSIDIAN_VAULT_PLUGINS_PATH = "C:\Users\you\Documents\Vault\.obsidian\plugins\obsidian-graph-intelligence"
 *   npm run deploy
 *
 * Example (.env file — add OBSIDIAN_VAULT_PLUGINS_PATH=... and never commit it):
 *   See .env.example for the template.
 */

import { copyFileSync, existsSync } from 'fs';

const dest = process.env.OBSIDIAN_VAULT_PLUGINS_PATH;

if (!dest) {
  console.error(
    '\n[deploy] Error: OBSIDIAN_VAULT_PLUGINS_PATH is not set.\n' +
    'Set it to your vault\'s plugin directory, for example:\n\n' +
    '  PowerShell:\n' +
    '    $env:OBSIDIAN_VAULT_PLUGINS_PATH = "C:\\Users\\you\\Documents\\Vault\\.obsidian\\plugins\\obsidian-graph-intelligence"\n\n' +
    '  bash/zsh:\n' +
    '    export OBSIDIAN_VAULT_PLUGINS_PATH="/path/to/vault/.obsidian/plugins/obsidian-graph-intelligence"\n\n' +
    'Or copy .env.example to .env and set the variable there.\n'
  );
  process.exit(1);
}

if (!existsSync(dest)) {
  console.error(`\n[deploy] Error: destination directory does not exist:\n  ${dest}\n`);
  process.exit(1);
}

const FILES = ['main.js', 'styles.css', 'manifest.json'];

console.log(`\n[deploy] Deploying to: ${dest}`);
for (const f of FILES) {
  copyFileSync(f, `${dest}/${f}`);
  console.log(`  ✓ ${f}`);
}
console.log('[deploy] Done!\n');
