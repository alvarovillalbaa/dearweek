import { readFileSync, writeFileSync } from 'node:fs';

const htmlPath = 'dist/index.html';
let html = readFileSync(htmlPath, 'utf8');
html = html.replace('<title>Dearweek</title>', '<title>Dearweek — a little closer, every week</title>');
html = html.replace('</head>', '<meta name="description" content="Keep your family close through weekly memories, private photos, and stories shared with the people you choose." /><meta name="theme-color" content="#F6F3EA" /></head>');
writeFileSync(htmlPath, html);
writeFileSync('dist/robots.txt', 'User-agent: *\nDisallow: /\n');
