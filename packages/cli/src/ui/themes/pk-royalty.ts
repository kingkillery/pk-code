/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';

const pkRoyaltyColors: ColorsTheme = {
  type: 'dark',
  Background: '#1a0d26', // Deep royal purple background
  Foreground: '#f4f1e8', // Cream/parchment text
  LightBlue: '#8A7EC8', // Lavender blue
  AccentBlue: '#6366F1', // Royal indigo
  AccentPurple: '#9333EA', // Rich purple
  AccentCyan: '#06B6D4', // Cyan accent
  AccentGreen: '#10B981', // Emerald green
  AccentYellow: '#F59E0B', // Royal gold
  AccentRed: '#DC2626', // Deep crimson
  Comment: '#8B7EC8', // Muted purple
  Gray: '#4C1D95', // Dark purple gray
  GradientColors: ['#FFD700', '#9333EA', '#6366F1'], // Gold to purple to indigo
};

export const PkRoyalty: Theme = new Theme(
  'PK Royalty',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: pkRoyaltyColors.Background,
      color: pkRoyaltyColors.Foreground,
    },
    'hljs-keyword': {
      color: pkRoyaltyColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: pkRoyaltyColors.AccentPurple,
    },
    'hljs-symbol': {
      color: pkRoyaltyColors.AccentCyan,
    },
    'hljs-name': {
      color: pkRoyaltyColors.LightBlue,
    },
    'hljs-link': {
      color: pkRoyaltyColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: pkRoyaltyColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-subst': {
      color: pkRoyaltyColors.Foreground,
    },
    'hljs-string': {
      color: pkRoyaltyColors.AccentGreen,
    },
    'hljs-title': {
      color: pkRoyaltyColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: pkRoyaltyColors.AccentBlue,
    },
    'hljs-attribute': {
      color: pkRoyaltyColors.AccentYellow,
    },
    'hljs-bullet': {
      color: pkRoyaltyColors.AccentYellow,
    },
    'hljs-addition': {
      color: pkRoyaltyColors.AccentGreen,
    },
    'hljs-variable': {
      color: pkRoyaltyColors.Foreground,
    },
    'hljs-template-tag': {
      color: pkRoyaltyColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: pkRoyaltyColors.AccentYellow,
    },
    'hljs-comment': {
      color: pkRoyaltyColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: pkRoyaltyColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: pkRoyaltyColors.AccentRed,
    },
    'hljs-meta': {
      color: pkRoyaltyColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
      color: pkRoyaltyColors.AccentYellow,
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-number': {
      color: pkRoyaltyColors.AccentPurple,
    },
    'hljs-regexp': {
      color: pkRoyaltyColors.AccentCyan,
    },
    'hljs-tag': {
      color: pkRoyaltyColors.AccentBlue,
    },
    'hljs-selector-tag': {
      color: pkRoyaltyColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-selector-id': {
      color: pkRoyaltyColors.AccentPurple,
    },
    'hljs-selector-class': {
      color: pkRoyaltyColors.AccentBlue,
    },
    'hljs-built_in': {
      color: pkRoyaltyColors.AccentRed,
      fontWeight: 'bold',
    },
  },
  pkRoyaltyColors,
);
