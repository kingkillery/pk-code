/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';

const pkDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#0b0e14',
  Foreground: '#bfbdb6',
  LightBlue: '#59C2FF',
  AccentBlue: '#39BAE6',
  AccentPurple: '#D2A6FF',
  AccentCyan: '#95E6CB',
  AccentGreen: '#AAD94C',
  AccentYellow: '#FFD700',
  AccentRed: '#F26D78',
  Comment: '#646A71',
  Gray: '#3D4149',
  GradientColors: ['#21859e', '#4da8d4'],
};

export const PKDark: Theme = new Theme(
  'PK Dark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: pkDarkColors.Background,
      color: pkDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: pkDarkColors.AccentYellow,
    },
    'hljs-literal': {
      color: pkDarkColors.AccentPurple,
    },
    'hljs-symbol': {
      color: pkDarkColors.AccentCyan,
    },
    'hljs-name': {
      color: pkDarkColors.LightBlue,
    },
    'hljs-link': {
      color: pkDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: pkDarkColors.AccentYellow,
    },
    'hljs-subst': {
      color: pkDarkColors.Foreground,
    },
    'hljs-string': {
      color: pkDarkColors.AccentGreen,
    },
    'hljs-title': {
      color: pkDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: pkDarkColors.AccentBlue,
    },
    'hljs-attribute': {
      color: pkDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: pkDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: pkDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: pkDarkColors.Foreground,
    },
    'hljs-template-tag': {
      color: pkDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: pkDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: pkDarkColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: pkDarkColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: pkDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: pkDarkColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  pkDarkColors,
);
