import {copyFileSync,cpSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
copyFileSync('dist/index.html','index.html');
rmSync('assets',{recursive:true,force:true});
cpSync('dist/assets','assets',{recursive:true});
cpSync('dist/images','images',{recursive:true});
writeFileSync('.nojekyll','');
console.log('GitHub Pages static artifact ready at repository root.');
