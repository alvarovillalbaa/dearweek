import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';

const htmlPath = 'dist/index.html';
let html = readFileSync(htmlPath, 'utf8');
html = html.replace('<title>Welyto</title>', '<title>Welyto — a little closer, every week</title>');
html = html.replace('</head>', '<meta name="description" content="Keep your family close through weekly memories, private photos, and stories shared with the people you choose." /><meta name="theme-color" content="#F6F3EA" /></head>');
writeFileSync(htmlPath, html);
writeFileSync('dist/robots.txt', 'User-agent: *\nDisallow: /\n');
// Bootstrap only: the first hosted install generates the lock without a local
// dependency installation. Remove this export once that exact lock is committed.
if (!existsSync('.lock-committed') && existsSync('package-lock.json')) copyFileSync('package-lock.json', 'dist/dependency-lock.json');
