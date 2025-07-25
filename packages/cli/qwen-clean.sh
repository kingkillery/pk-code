#!/bin/bash
# Wrapper script to run Qwen CLI with deprecation warnings suppressed
node --no-deprecation --no-warnings dist/index.js "$@"
