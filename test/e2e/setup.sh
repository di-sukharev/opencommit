#!/bin/sh

current_dir=$(pwd)
setup_dir="$(cd "$(dirname "$0")" && pwd)"

# Set up for prompt-module/commitlint
cd $setup_dir && cd prompt-module/data/commitlint_9 && npm ci
cd $setup_dir && cd prompt-module/data/commitlint_18 && npm ci
cd $setup_dir && cd prompt-module/data/commitlint_19 && npm ci

cd $current_dir
