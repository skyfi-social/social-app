const path = require('path')
const fs = require('fs')

const projectRoot = path.join(__dirname, '..')
const templateFile = path.join(
  projectRoot,
  'bskyweb',
  'templates',
  'scripts.html',
)

const {entrypoints} = require(
  path.join(projectRoot, 'web-build/asset-manifest.json'),
)

console.log(`Found ${entrypoints.length} entrypoints`)
console.log(`Writing ${templateFile}`)

const outputFile = entrypoints
  .map(name => {
    const file = path.basename(name)
    const ext = path.extname(file)

    if (ext === '.js') {
      return `<script defer="defer" src="{{ staticCDNHost }}/static/js/${file}"></script>`
    }
    if (ext === '.css') {
      return `<link rel="stylesheet" href="{{ staticCDNHost }}/static/css/${file}">`
    }

    return ''
  })
  .join('\n')
fs.writeFileSync(templateFile, outputFile)

// Copy client-metadata.json to web-build for Cloudflare Pages deployment
const clientMetadataSource = path.join(
  projectRoot,
  'public/client-metadata.json',
)
const clientMetadataTarget = path.join(
  projectRoot,
  'web-build/client-metadata.json',
)

if (fs.existsSync(clientMetadataSource)) {
  fs.copyFileSync(clientMetadataSource, clientMetadataTarget)
  console.log(`Copied client-metadata.json to web-build`)
} else {
  console.warn('Warning: client-metadata.json not found in public directory')
}
