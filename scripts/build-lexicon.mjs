import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({entryPoints:[root+'vendor/hunspell-runtime.cjs'],outfile:root+'dist/vendor/hunspell.js',bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true,legalComments:'eof'});
console.log('Lokale Hunspell-Laufzeit erstellt.');
