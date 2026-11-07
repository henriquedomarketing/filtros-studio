import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('Filtros Studio é a marca visível no aplicativo',()=>{
 assert.match(page,/<title>Filtros Studio/);
 assert.match(app,/Filtros Studio/);
 assert.match(app,/class="brand-mark fs-logo-mark"/);
 assert.doesNotMatch(page,/Camera Marketing Studio/);
 assert.doesNotMatch(app,/Camera Marketing Studio|camera marketing<small>/);
 assert.equal(pkg.name,'filtros-studio');
});
