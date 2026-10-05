// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'omni', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'omni', style: 'camelCase' }],
      // Separate .ts / .html / .scss files — no inline templates or styles.
      '@angular-eslint/component-max-inline-declarations': ['error', { template: 0, styles: 0, animations: 0 }],
      // Signal-based APIs only: input(), output(), model(), viewChild(), contentChildren().
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-signal-model': 'error',
      '@angular-eslint/prefer-output-emitter-ref': 'error',
      '@angular-eslint/prefer-output-readonly': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Property[key.name=/^styleUrls?$/] Literal[value=/\\.css$/]',
          message: 'Use SCSS (.scss) for component styles, never .css.',
        },
        {
          selector:
            'Decorator[expression.callee.name=/^(Input|Output|ViewChild|ViewChildren|ContentChild|ContentChildren)$/]',
          message: 'Use signal-based input()/output()/model()/viewChild()/contentChildren() instead of decorators.',
        },
        {
          selector: 'NewExpression[callee.name="EventEmitter"]',
          message: 'Use output() instead of EventEmitter.',
        },
      ],
    },
  },
  {
    files: ['projects/examples/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // Built-in control flow only: @if / @for / @switch.
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/no-empty-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
    },
  }
);
