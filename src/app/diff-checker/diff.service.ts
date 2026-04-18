import { Injectable } from '@angular/core';
import { DiffOp, DiffOptions, DiffStats, Hunk } from './diff.types';

const CTX = 3;
const ESC_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

@Injectable({ providedIn: 'root' })
export class DiffService {
  esc(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => ESC_MAP[ch]);
  }

  private normalize(s: string, opts: DiffOptions): string {
    if (opts.ignoreWhitespace) s = s.replace(/\s+/g, ' ').trim();
    if (opts.ignoreCase) s = s.toLowerCase();
    return s;
  }

  private lcsLines(a: string[], b: string[], opts: DiffOptions): DiffOp[] {
    const aN = a.map((s) => this.normalize(s, opts));
    const bN = b.map((s) => this.normalize(s, opts));
    const n = aN.length,
      m = bN.length;
    const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (aN[i] === bN[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops: DiffOp[] = [];
    let i = 0,
      j = 0;
    while (i < n && j < m) {
      if (aN[i] === bN[j]) {
        ops.push({ type: 'eq', a: a[i], b: b[j], ai: i, bi: j });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: 'del', a: a[i], ai: i });
        i++;
      } else {
        ops.push({ type: 'add', b: b[j], bi: j });
        j++;
      }
    }
    while (i < n) {
      ops.push({ type: 'del', a: a[i], ai: i });
      i++;
    }
    while (j < m) {
      ops.push({ type: 'add', b: b[j], bi: j });
      j++;
    }
    return ops;
  }

  private pairChangeBlocks(ops: DiffOp[]): DiffOp[] {
    const out: DiffOp[] = [];
    let i = 0;
    while (i < ops.length) {
      if (ops[i].type === 'eq') {
        out.push(ops[i]);
        i++;
        continue;
      }
      const dels: DiffOp[] = [],
        adds: DiffOp[] = [];
      while (i < ops.length && ops[i].type !== 'eq') {
        if (ops[i].type === 'del') dels.push(ops[i]);
        else adds.push(ops[i]);
        i++;
      }
      const k = Math.min(dels.length, adds.length);
      for (let p = 0; p < k; p++) {
        out.push({ type: 'mod', a: dels[p].a, b: adds[p].b, ai: dels[p].ai, bi: adds[p].bi });
      }
      for (let p = k; p < dels.length; p++) out.push(dels[p]);
      for (let p = k; p < adds.length; p++) out.push(adds[p]);
    }
    return out;
  }

  private countA(ops: DiffOp[]): number {
    return ops.filter((o) => o.type === 'eq' || o.type === 'del' || o.type === 'mod').length;
  }

  private countB(ops: DiffOp[]): number {
    return ops.filter((o) => o.type === 'eq' || o.type === 'add' || o.type === 'mod').length;
  }

  private makeHunks(ops: DiffOp[]): Hunk[] {
    const hasChange = ops.map((o) => o.type !== 'eq');
    if (!hasChange.some(Boolean)) {
      if (ops.length === 0) return [];
      return [
        {
          ops,
          aStart: ops[0].ai ?? 0,
          bStart: ops[0].bi ?? 0,
          aCount: this.countA(ops),
          bCount: this.countB(ops),
        },
      ];
    }
    const keep = new Array(ops.length).fill(false);
    for (let i = 0; i < ops.length; i++) {
      if (hasChange[i]) {
        for (let k = Math.max(0, i - CTX); k <= Math.min(ops.length - 1, i + CTX); k++) {
          keep[k] = true;
        }
      }
    }
    const hunks: Hunk[] = [];
    let cur: Hunk | null = null;
    for (let i = 0; i < ops.length; i++) {
      if (keep[i]) {
        if (!cur) cur = { ops: [], aStart: -1, bStart: -1, aCount: 0, bCount: 0 };
        cur.ops.push(ops[i]);
        if (cur.aStart === -1) cur.aStart = ops[i].ai ?? 0;
        if (cur.bStart === -1) cur.bStart = ops[i].bi ?? 0;
      } else {
        if (cur) {
          cur.aCount = this.countA(cur.ops);
          cur.bCount = this.countB(cur.ops);
          hunks.push(cur);
          cur = null;
        }
      }
    }
    if (cur) {
      cur.aCount = this.countA(cur.ops);
      cur.bCount = this.countB(cur.ops);
      hunks.push(cur);
    }
    return hunks;
  }

  diffWordsHTML(aLine: string, bLine: string): { leftHTML: string; rightHTML: string } {
    const splitWords = (s: string) => s.split(/(\s+|\b)/).filter((x) => x !== '');
    const a = splitWords(aLine),
      b = splitWords(bLine);
    const n = a.length,
      m = b.length;
    const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    let i = 0,
      j = 0,
      leftHTML = '',
      rightHTML = '';
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        leftHTML += this.esc(a[i]);
        rightHTML += this.esc(b[j]);
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        leftHTML += `<span class="w-del">${this.esc(a[i])}</span>`;
        i++;
      } else {
        rightHTML += `<span class="w-add">${this.esc(b[j])}</span>`;
        j++;
      }
    }
    while (i < n) {
      leftHTML += `<span class="w-del">${this.esc(a[i])}</span>`;
      i++;
    }
    while (j < m) {
      rightHTML += `<span class="w-add">${this.esc(b[j])}</span>`;
      j++;
    }
    return { leftHTML, rightHTML };
  }

  renderSplit(hunks: Hunk[], wordDiff: boolean): string {
    let html = `<table class="diff-table"><colgroup>
      <col class="num"><col class="sign"><col class="code">
      <col class="num"><col class="sign"><col class="code">
    </colgroup><tbody>`;
    for (const h of hunks) {
      const aStart = h.aStart + 1;
      const bStart = h.bStart + 1;
      html += `<tr class="hunk"><td colspan="6" class="hunk-cell">@@ -${aStart},${h.aCount} +${bStart},${h.bCount} @@</td></tr>`;
      for (const op of h.ops) {
        if (op.type === 'eq') {
          html += `<tr class="ctx">
            <td class="num-cell">${(op.ai ?? 0) + 1}</td><td class="sign-cell"> </td><td class="code-cell">${this.esc(op.a!)}</td>
            <td class="num-cell">${(op.bi ?? 0) + 1}</td><td class="sign-cell"> </td><td class="code-cell right">${this.esc(op.b!)}</td>
          </tr>`;
        } else if (op.type === 'mod') {
          let left = this.esc(op.a!),
            right = this.esc(op.b!);
          if (wordDiff) {
            const d = this.diffWordsHTML(op.a!, op.b!);
            left = d.leftHTML;
            right = d.rightHTML;
          }
          html += `<tr class="del">
            <td class="num-cell">${(op.ai ?? 0) + 1}</td><td class="sign-cell">−</td><td class="code-cell">${left}</td>
            <td class="num-cell" style="background:var(--diff-add-gutter);color:#b8e6c1;">${(op.bi ?? 0) + 1}</td>
            <td class="sign-cell" style="background:var(--diff-add-gutter);color:#3fb950;">+</td>
            <td class="code-cell right" style="background:var(--diff-add-bg);">${right}</td>
          </tr>`;
        } else if (op.type === 'del') {
          html += `<tr class="del">
            <td class="num-cell">${(op.ai ?? 0) + 1}</td><td class="sign-cell">−</td><td class="code-cell">${this.esc(op.a!)}</td>
            <td class="num-cell" style="background:var(--diff-empty-bg);"></td>
            <td class="sign-cell" style="background:var(--diff-empty-bg);"></td>
            <td class="code-cell right" style="background:var(--diff-empty-bg);"></td>
          </tr>`;
        } else if (op.type === 'add') {
          html += `<tr class="add">
            <td class="num-cell" style="background:var(--diff-empty-bg);color:var(--fg-subtle);"></td>
            <td class="sign-cell" style="background:var(--diff-empty-bg);"></td>
            <td class="code-cell" style="background:var(--diff-empty-bg);"></td>
            <td class="num-cell">${(op.bi ?? 0) + 1}</td><td class="sign-cell">+</td><td class="code-cell right">${this.esc(op.b!)}</td>
          </tr>`;
        }
      }
    }
    html += `</tbody></table>`;
    return html;
  }

  renderUnified(hunks: Hunk[], wordDiff: boolean): string {
    let html = `<table class="diff-table"><colgroup>
      <col class="num"><col class="num"><col class="sign"><col class="code">
    </colgroup><tbody>`;
    for (const h of hunks) {
      const aStart = h.aStart + 1;
      const bStart = h.bStart + 1;
      html += `<tr class="hunk"><td colspan="4" class="hunk-cell">@@ -${aStart},${h.aCount} +${bStart},${h.bCount} @@</td></tr>`;
      for (const op of h.ops) {
        if (op.type === 'eq') {
          html += `<tr class="ctx">
            <td class="num-cell">${(op.ai ?? 0) + 1}</td><td class="num-cell">${(op.bi ?? 0) + 1}</td>
            <td class="sign-cell"> </td><td class="code-cell">${this.esc(op.a!)}</td>
          </tr>`;
        } else if (op.type === 'mod') {
          const d = wordDiff
            ? this.diffWordsHTML(op.a!, op.b!)
            : { leftHTML: this.esc(op.a!), rightHTML: this.esc(op.b!) };
          html += `<tr class="del">
            <td class="num-cell">${(op.ai ?? 0) + 1}</td><td class="num-cell"></td>
            <td class="sign-cell">−</td><td class="code-cell">${d.leftHTML}</td>
          </tr>`;
          html += `<tr class="add">
            <td class="num-cell"></td><td class="num-cell">${(op.bi ?? 0) + 1}</td>
            <td class="sign-cell">+</td><td class="code-cell">${d.rightHTML}</td>
          </tr>`;
        } else if (op.type === 'del') {
          html += `<tr class="del">
            <td class="num-cell">${(op.ai ?? 0) + 1}</td><td class="num-cell"></td>
            <td class="sign-cell">−</td><td class="code-cell">${this.esc(op.a!)}</td>
          </tr>`;
        } else if (op.type === 'add') {
          html += `<tr class="add">
            <td class="num-cell"></td><td class="num-cell">${(op.bi ?? 0) + 1}</td>
            <td class="sign-cell">+</td><td class="code-cell">${this.esc(op.b!)}</td>
          </tr>`;
        }
      }
    }
    html += `</tbody></table>`;
    return html;
  }

  compute(
    aText: string,
    bText: string,
    opts: DiffOptions,
  ): { hunks: Hunk[]; stats: DiffStats } {
    const aLines = aText.split('\n');
    const bLines = bText.split('\n');
    let ops = this.lcsLines(aLines, bLines, opts);
    ops = this.pairChangeBlocks(ops);
    const hunks = this.makeHunks(ops);

    let additions = 0,
      deletions = 0,
      eqs = 0;
    for (const o of ops) {
      if (o.type === 'add') additions++;
      else if (o.type === 'del') deletions++;
      else if (o.type === 'mod') {
        additions++;
        deletions++;
      } else eqs++;
    }
    const total = Math.max(1, aLines.length + bLines.length);
    const similarity = Math.max(0, Math.min(100, Math.round(((eqs * 2) / total) * 100)));

    return { hunks, stats: { additions, deletions, similarity, hunks: hunks.length } };
  }
}
