import {
  Component,
  HostListener,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DiffOptions, DiffStats } from './diff.types';
import { DiffService } from './diff.service';

@Component({
  selector: 'dk-diff-checker-diff-checker',
  standalone: true,
  templateUrl: './diff-checker.component.html',
  styleUrl: './diff-checker.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DiffCheckerComponent {
  private sanitizer = inject(DomSanitizer);
  private diffService = inject(DiffService);

  inputA = signal('');
  inputB = signal('');
  viewMode = signal<'split' | 'unified'>('split');
  wordDiff = signal(true);
  ignoreWhitespace = signal(false);
  ignoreCase = signal(false);

  diffHtml = signal<SafeHtml>('');
  stats = signal<DiffStats>({ additions: 0, deletions: 0, similarity: 100, hunks: 0 });
  statusTime = signal('0 ms');

  sizeA = computed(() => this.formatSize(this.inputA()));
  sizeB = computed(() => this.formatSize(this.inputB()));
  isEmpty = computed(() => !this.inputA() && !this.inputB());
  isIdentical = computed(() => !this.isEmpty() && this.stats().hunks === 0);

  headSquares = computed(() => {
    const { additions, deletions } = this.stats();
    const total = additions + deletions;
    if (total === 0) return Array(5).fill('neutral') as ('plus' | 'minus' | 'neutral')[];
    const showAdd = Math.max(additions > 0 ? 1 : 0, Math.round((additions / total) * 5));
    const showDel = 5 - showAdd;
    const result: ('plus' | 'minus' | 'neutral')[] = [];
    for (let i = 0; i < Math.min(5, showAdd); i++) result.push('plus');
    for (let i = 0; i < Math.min(5 - Math.min(5, showAdd), showDel); i++) result.push('minus');
    while (result.length < 5) result.push('neutral');
    return result;
  });

  private _timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const a = this.inputA();
      const b = this.inputB();
      const vm = this.viewMode();
      const opts: DiffOptions = {
        wordDiff: this.wordDiff(),
        ignoreWhitespace: this.ignoreWhitespace(),
        ignoreCase: this.ignoreCase(),
      };
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._compute(a, b, vm, opts), 80);
    });

    this.loadExample();
  }

  private _compute(
    a: string,
    b: string,
    vm: 'split' | 'unified',
    opts: DiffOptions,
  ): void {
    const t0 = performance.now();
    const { hunks, stats } = this.diffService.compute(a, b, opts);
    const html =
      vm === 'split'
        ? this.diffService.renderSplit(hunks, opts.wordDiff)
        : this.diffService.renderUnified(hunks, opts.wordDiff);
    this.diffHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
    this.stats.set(stats);
    this.statusTime.set((performance.now() - t0).toFixed(1) + ' ms');
  }

  compare(): void {
    clearTimeout(this._timer);
    this._compute(this.inputA(), this.inputB(), this.viewMode(), {
      wordDiff: this.wordDiff(),
      ignoreWhitespace: this.ignoreWhitespace(),
      ignoreCase: this.ignoreCase(),
    });
  }

  swap(): void {
    const tmp = this.inputA();
    this.inputA.set(this.inputB());
    this.inputB.set(tmp);
  }

  clearAll(): void {
    this.inputA.set('');
    this.inputB.set('');
  }

  async pasteA(): Promise<void> {
    try {
      this.inputA.set(await navigator.clipboard.readText());
    } catch {
      /* clipboard access denied */
    }
  }

  async pasteB(): Promise<void> {
    try {
      this.inputB.set(await navigator.clipboard.readText());
    } catch {
      /* clipboard access denied */
    }
  }

  toggleTheme(): void {
    const cur = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
  }

  formatSize(text: string): string {
    if (!text) return '0 B · 0 lines';
    const bytes = new Blob([text]).size;
    const lines = text.split('\n').length;
    let size: string;
    if (bytes < 1024) size = bytes + ' B';
    else if (bytes < 1024 * 1024) size = (bytes / 1024).toFixed(1) + ' KB';
    else size = (bytes / 1024 / 1024).toFixed(2) + ' MB';
    return `${size} · ${lines} lines`;
  }

  loadExample(): void {
    this.inputA.set(`{
  "private": true,
  "packageManager": "bun@1.3.4",
  "dependencies": {
    "@angular/common": "^21.1.0",
    "@angular/compiler": "^21.1.0",
    "@angular/core": "^21.1.0",
    "@angular/forms": "^21.1.0",
    "@angular/platform-browser": "^21.1.0",
    "@angular/router": "^21.1.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular/build": "^21.1.2",
    "@angular/cli": "^21.1.2",
    "@angular/compiler-cli": "^21.1.0"
  }
}`);
    this.inputB.set(`{
  "private": true,
  "packageManager": "bun@1.3.4",
  "dependencies": {
    "@angular-architects/native-federation": "^21.2.3",
    "@angular/animations": "^21.1.0",
    "@angular/common": "^21.1.0",
    "@angular/compiler": "^21.1.0",
    "@angular/core": "^21.1.0",
    "@angular/forms": "^21.1.0",
    "@angular/platform-browser": "^21.1.0",
    "@angular/router": "^21.1.0",
    "@softarc/native-federation-node": "^3.3.4",
    "es-module-shims": "^1.5.12",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^21.1.2",
    "@angular/build": "^21.1.2",
    "@angular/cli": "^21.1.2",
    "@angular/compiler-cli": "^21.1.0"
  }
}`);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      this.compare();
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      this.swap();
    }
  }
}
