/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';

const pkLightColors: ColorsTheme = {
  type: 'light',
  Background: '#f8f9fa',
  Foreground: '#5c6166',
  LightBlue: '#55b4d4',
  AccentBlue: '#399ee6',
  AccentPurple: '#a37acc',
  AccentCyan: '#4cbf99',
  AccentGreen: '#86b300',
  AccentYellow: '#f2ae49',
  AccentRed: '#f07171',
  Comment: '#ABADB1',
  Gray: '#CCCFD3',
  GradientColors: ['#21859e', '#399ee6'],
};

export const QwenLight: Theme = new Theme(
  'PK Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: pkLightColors.Background,
      color: pkLightColors.Foreground,
    },
    'hljs-comment': {
      color: pkLightColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: pkLightColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-string': {
      color: pkLightColors.AccentGreen,
    },
    'hljs-constant': {
      color: pkLightColors.AccentCyan,
    },
    'hljs-number': {
      color: pkLightColors.AccentPurple,
    },
    'hljs-keyword': {
      color: pkLightColors.AccentYellow,
    },
    'hljs-selector-tag': {
      color: pkLightColors.AccentYellow,
    },
    'hljs-attribute': {
      color: pkLightColors.AccentYellow,
    },
    'hljs-variable': {
      color: pkLightColors.Foreground,
    },
    'hljs-variable.language': {
      color: pkLightColors.LightBlue,
      fontStyle: 'italic',
    },
    'hljs-title': {
      color: pkLightColors.AccentBlue,
    },
    'hljs-section': {
      color: pkLightColors.AccentGreen,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: pkLightColors.LightBlue,
    },
    'hljs-class .hljs-title': {
      color: pkLightColors.AccentBlue,
    },
    'hljs-tag': {
      color: pkLightColors.LightBlue,
    },
    'hljs-name': {
      color: pkLightColors.AccentBlue,
    },
    'hljs-builtin-name': {
      color: pkLightColors.AccentYellow,
    },
    'hljs-meta': {
      color: pkLightColors.AccentYellow,
    },
    'hljs-symbol': {
      color: pkLightColors.AccentRed,
    },
    'hljs-bullet': {
      color: pkLightColors.AccentYellow,
    },
    'hljs-regexp': {
      color: pkLightColors.AccentCyan,
    },
    'hljs-link': {
      color: pkLightColors.LightBlue,
    },
    'hljs-deletion': {
      color: pkLightColors.AccentRed,
    },
    'hljs-addition': {
      color: pkLightColors.AccentGreen,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: pkLightColors.AccentCyan,
    },
    'hljs-built_in': {
      color: pkLightColors.AccentRed,
    },
    'hljs-doctag': {
      color: pkLightColors.AccentRed,
    },
    'hljs-template-variable': {
      color: pkLightColors.AccentCyan,
    },
    'hljs-selector-id': {
      color: pkLightColors.AccentRed,
    },
  },
  pkLightColors,
);
