import { build } from 'esbuild'
import fs from 'fs'    

await build({
    entryPoints: ['./src/cli.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: './out/cli.cjs',
});

const wasmFile = fs.readFileSync('./node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm')

fs.writeFileSync('./out/tiktoken_bg.wasm', wasmFile)
