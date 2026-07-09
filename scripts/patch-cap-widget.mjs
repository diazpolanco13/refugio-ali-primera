#!/usr/bin/env node
// Parchea cap-widget 0.1.56: al desmontar el login (React) mientras el PoW
// especulativo sigue, cleanup() anula #speculativePool y las continuaciones
// async llaman _ensureSize sobre null → TypeError en consola.
// Ver: https://github.com/tiagozip/cap/pull/257 e issue #203.

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const pkgDir = join(root, "node_modules", "cap-widget");

function patchMin(file) {
  if (!existsSync(file)) return false;
  let s = readFileSync(file, "utf8");
  if (s.includes("if(!this.#p||!this.#d)return s;this.#p._ensureSize")) {
    return false; // ya aplicado
  }
  const before = s;
  s = s.replace(
    "this.#d.promoteFn=e=>{n||(n=!0,r=e,this.#p._size=e,this.#p._ensureSize(e))}",
    "this.#d.promoteFn=e=>{n||!this.#p||(n=!0,r=e,this.#p._size=e,this.#p._ensureSize(e))}",
  );
  s = s.replace(
    "l.push(a),o.push(e[a]),a++;this.#p._ensureSize(Math.max(r,t));const c=await Promise.all",
    "l.push(a),o.push(e[a]),a++;if(!this.#p||!this.#d)return s;this.#p._ensureSize(Math.max(r,t));const c=await Promise.all",
  );
  s = s.replace(
    "const c=await Promise.all(o.map(e=>this.#p.run(e[0],e[1]).then(e=>(this.#d&&this.#d.completedCount++,e))));for(let e=0;e<l.length;e++)s[l[e]]=c[e];!n&&a<i&&await new Promise(e=>setTimeout(e,120))",
    "const c=await Promise.all(o.map(e=>this.#p.run(e[0],e[1]).then(e=>(this.#d&&this.#d.completedCount++,e))));if(!this.#p||!this.#d)return s;for(let e=0;e<l.length;e++)s[l[e]]=c[e];!n&&a<i&&await new Promise(e=>setTimeout(e,120));if(!this.#p||!this.#d)return s",
  );
  if (s === before) {
    throw new Error(`No se pudo parchear ${file} (¿cambió la versión de cap-widget?)`);
  }
  writeFileSync(file, s);
  return true;
}

function patchSrc(file) {
  if (!existsSync(file)) return false;
  let s = readFileSync(file, "utf8");
  if (s.includes("if (!this.#speculativePool || !this.#speculative) return results;")) {
    return false;
  }
  const before = s;
  s = s.replace(
    `      this.#speculative.promoteFn = (fullCount) => {
        if (promoted) return;
        promoted = true;
        concurrency = fullCount;
        this.#speculativePool._size = fullCount;
        this.#speculativePool._ensureSize(fullCount);
      };`,
    `      this.#speculative.promoteFn = (fullCount) => {
        if (promoted) return;
        if (!this.#speculativePool) return;
        promoted = true;
        concurrency = fullCount;
        this.#speculativePool._size = fullCount;
        this.#speculativePool._ensureSize(fullCount);
      };`,
  );
  s = s.replace(
    `        this.#speculativePool._ensureSize(Math.max(concurrency, batchSize));

        const batchResults = await Promise.all(
          batch.map((challenge) =>
            this.#speculativePool
              .run(challenge[0], challenge[1])
              .then((nonce) => {
                if (this.#speculative) this.#speculative.completedCount++;
                return nonce;
              }),
          ),
        );

        for (let i = 0; i < batchIndices.length; i++) {
          results[batchIndices[i]] = batchResults[i];
        }

        if (!promoted && nextIndex < total) {
          await new Promise((resolve) =>
            setTimeout(resolve, SPECULATIVE_YIELD_MS),
          );
        }
      }`,
    `        if (!this.#speculativePool || !this.#speculative) return results;
        this.#speculativePool._ensureSize(Math.max(concurrency, batchSize));

        const batchResults = await Promise.all(
          batch.map((challenge) =>
            this.#speculativePool
              .run(challenge[0], challenge[1])
              .then((nonce) => {
                if (this.#speculative) this.#speculative.completedCount++;
                return nonce;
              }),
          ),
        );

        if (!this.#speculativePool || !this.#speculative) return results;

        for (let i = 0; i < batchIndices.length; i++) {
          results[batchIndices[i]] = batchResults[i];
        }

        if (!promoted && nextIndex < total) {
          await new Promise((resolve) =>
            setTimeout(resolve, SPECULATIVE_YIELD_MS),
          );
          if (!this.#speculativePool || !this.#speculative) return results;
        }
      }`,
  );
  if (s === before) {
    throw new Error(`No se pudo parchear ${file} (¿cambió la versión de cap-widget?)`);
  }
  writeFileSync(file, s);
  return true;
}

if (!existsSync(pkgDir)) {
  console.log("cap-widget no instalado; se omite el parche.");
  process.exit(0);
}

const changedMin = patchMin(join(pkgDir, "cap.min.js"));
const changedSrc = patchSrc(join(pkgDir, "src", "cap.js"));

const viteDep = join(root, "node_modules", ".vite", "deps", "cap-widget.js");
if ((changedMin || changedSrc) && existsSync(viteDep)) {
  unlinkSync(viteDep);
  const map = `${viteDep}.map`;
  if (existsSync(map)) unlinkSync(map);
}

if (changedMin || changedSrc) {
  console.log("cap-widget: parche anti-_ensureSize aplicado.");
} else {
  console.log("cap-widget: parche ya presente.");
}
